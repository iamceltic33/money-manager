import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { LocalDeletion } from '@/shared/api/local-db';

import type { CloudRow, SyncRemote, SyncSnapshot, SyncTable } from './types';

const columns = {
  categories: ['id', 'user_id', 'type', 'name', 'color', 'icon', 'sort_order', 'created_at', 'updated_at', 'exclude_from_average'],
  transactions: ['id', 'user_id', 'type', 'amount', 'category_id', 'note', 'occurred_at', 'created_at', 'updated_at', 'exclude_from_average'],
} as const;

type LocalRow = Record<string, SQLiteBindValue> & {
  id: string;
  user_id: string;
  remote_id: string | null;
  remote_updated_at: string | null;
  local_revision: number;
  sync_status: string;
};

const entityType = (table: SyncTable) => table === 'categories' ? 'category' : 'transaction';
const errorMessage = (error: unknown) => error instanceof Error
  ? error.message
  : 'Не удалось синхронизировать запись';

const pushDeletions = async (database: SQLiteDatabase, remote: SyncRemote, userId: string) => {
  const deletions = await database.getAllAsync<LocalDeletion>(
    `select * from local_deletions where user_id = ? order by entity_type desc, deleted_at, entity_id;`,
    userId
  );

  for (const deletion of deletions) {
    const table = deletion.entity_type === 'category' ? 'categories' : 'transactions';
    const keys = [userId, deletion.entity_type, deletion.entity_id, deletion.revision];

    try {
      await remote.remove(table, deletion.remote_id ?? deletion.entity_id);
      await database.runAsync(
        'delete from local_deletions where user_id = ? and entity_type = ? and entity_id = ? and revision = ?;',
        ...keys
      );
    } catch (error) {
      await database.runAsync(
        `update local_deletions set sync_status = 'failed', sync_error = ?
         where user_id = ? and entity_type = ? and entity_id = ? and revision = ?;`,
        errorMessage(error), ...keys
      );
      throw error;
    }
  }
};

const pushRows = async (database: SQLiteDatabase, remote: SyncRemote, userId: string, table: SyncTable) => {
  const rows = await database.getAllAsync<LocalRow>(
    `select * from ${table} where user_id = ? and sync_status in ('pending', 'failed') order by id;`, userId
  );

  for (const row of rows) {
    const current = await database.getFirstAsync<LocalRow>(
      `select * from ${table} where user_id = ? and id = ?;`, userId, row.id
    );
    if (!current || current.local_revision !== row.local_revision) continue;

    // Старые раздельные идентификаторы требуют явного сопоставления перед обменом.
    if (row.remote_id && row.remote_id !== row.id) {
      throw new Error('Локальный и облачный ID записи различаются');
    }

    if (table === 'transactions' && row.category_id) {
      const category = await database.getFirstAsync<LocalRow>(
        `select * from categories where user_id = ? and id = ?;`, userId, row.category_id
      );
      if (!category || category.sync_status !== 'synced') continue;
    }

    const payload = Object.fromEntries(columns[table].map((key) => [
      key, key === 'exclude_from_average' ? row[key] === 1 : row[key],
    ])) as CloudRow;

    try {
      const saved = await remote.upsert(table, payload, row.remote_updated_at);
      await database.runAsync(
        `update ${table} set remote_id = ?, remote_updated_at = ? where user_id = ? and id = ?;`,
        saved.id, saved.updated_at, userId, row.id
      );
      // Новая локальная правка или удаление после начала запроса не подтверждается этим ответом.
      await database.runAsync(
        `update ${table} set remote_id = ?, updated_at = ?, sync_status = 'synced', sync_error = null
         where user_id = ? and id = ? and local_revision = ?;`,
        saved.id, saved.updated_at, userId, row.id, row.local_revision
      );
    } catch (error) {
      await database.runAsync(
        `update ${table} set sync_status = 'failed', sync_error = ?
         where user_id = ? and id = ? and local_revision = ?;`,
        errorMessage(error), userId, row.id, row.local_revision
      );
      throw error;
    }
  }
};

const pullRows = async (database: SQLiteDatabase, userId: string, table: SyncTable, rows: CloudRow[]) => {
  for (const row of rows) {
    if (row.user_id !== userId) throw new Error('Получены данные другого аккаунта');
    const values = columns[table].map((key) => {
      const value = (row as unknown as Record<string, SQLiteBindValue>)[key];
      return key === 'exclude_from_average' ? (value ? 1 : 0) : value;
    });
    const assignments = columns[table].filter(key => key !== 'id' && key !== 'user_id')
      .map(key => `${key} = excluded.${key}`).join(', ');

    // При удалённой локально категории серверная операция остаётся без категории.
    if (table === 'transactions') {
      const index = columns.transactions.indexOf('category_id');
      if (values[index] && !await database.getFirstAsync(
        'select id from categories where user_id = ? and id = ?;', userId, values[index]
      )) values[index] = null;
    }

    await database.runAsync(
      `insert into ${table} (${columns[table].join(', ')}, remote_id, remote_updated_at, sync_status)
       select ${columns[table].map(() => '?').join(', ')}, ?, ?, 'synced'
       where not exists (
         select 1 from local_deletions where user_id = ? and entity_type = ? and entity_id = ?
       ) and not exists (
         select 1 from ${table} where id = ? and (user_id != ? or sync_status != 'synced')
       )
       on conflict (id) do update set ${assignments}, remote_id = excluded.remote_id,
         remote_updated_at = excluded.remote_updated_at, sync_status = 'synced', sync_error = null, remote_deleted = 0
       where ${table}.user_id = excluded.user_id and ${table}.sync_status = 'synced';`,
      ...values, row.id, row.updated_at, userId, entityType(table), row.id, row.id, userId
    );
  }
};

const removeMissingRows = async (database: SQLiteDatabase, userId: string, table: SyncTable, rows: CloudRow[]) => {
  const ids = JSON.stringify(rows.map(row => row.id));
  const guard = table === 'categories'
    ? `and not exists (select 1 from transactions where category_id = categories.id and sync_status != 'synced')`
    : '';

  // Метка принадлежит записи, а не соединению: параллельная локальная правка
  // переводит запись в pending и сбрасывает метку через триггер версии.
  await database.runAsync(
    `update ${table} set remote_deleted = 1
     where user_id = ? and sync_status = 'synced'
       and id not in (select value from json_each(?)) ${guard};`, userId, ids
  );
  await database.runAsync(
    `delete from ${table} where user_id = ? and sync_status = 'synced' and remote_deleted = 1
       and id not in (select value from json_each(?)) ${guard};`, userId, ids
  );
};

export const synchronizeDatabase = async (database: SQLiteDatabase, remote: SyncRemote, userId: string) => {
  const initialized = await database.getFirstAsync('select id from local_users where id = ?;', userId);
  const localData = await database.getFirstAsync(
    `select id from categories where user_id = ? union all select id from transactions where user_id = ?
     union all select entity_id from local_deletions where user_id = ? limit 1;`, userId, userId, userId
  );
  await remote.initialize(!initialized && !localData);

  // Ограниченное число проходов: пользователь может продолжать редактировать данные.
  // Оставшиеся pending сохраняются для следующего запуска.
  for (let pass = 0; pass < 3; pass += 1) {
    await pushDeletions(database, remote, userId);
    await pushRows(database, remote, userId, 'categories');
    await pushRows(database, remote, userId, 'transactions');
    await pushDeletions(database, remote, userId);
    const dirty = await database.getFirstAsync(
      `select id from categories where user_id = ? and sync_status != 'synced'
       union all select id from transactions where user_id = ? and sync_status != 'synced' limit 1;`,
      userId, userId
    );
    if (!dirty) break;
  }

  const snapshot: SyncSnapshot = await remote.snapshot();
  // Проверяем весь ответ до удаления каких-либо локальных данных.
  if (!Array.isArray(snapshot.categories) || !Array.isArray(snapshot.transactions)
    || [...snapshot.categories, ...snapshot.transactions].some(row => row.user_id !== userId)) {
    throw new Error('Некорректный снимок данных аккаунта');
  }
  await removeMissingRows(database, userId, 'transactions', snapshot.transactions);
  await removeMissingRows(database, userId, 'categories', snapshot.categories);
  await pullRows(database, userId, 'categories', snapshot.categories);
  await pullRows(database, userId, 'transactions', snapshot.transactions);
  const now = new Date().toISOString();
  await database.runAsync(
    'insert or ignore into local_users (id, created_at, initialized_at) values (?, ?, ?);', userId, now, now
  );
};
