import { runLocalWrite, withLocalTransaction } from '@/shared/api/local-db/write-coordinator';
import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { LocalDeletion } from '@/shared/api/local-db';

import type { CloudCategory, CloudRow, SyncRemote, SyncSnapshot, SyncTable } from './types';

const columns = {
  categories: ['id', 'user_id', 'type', 'name', 'color', 'icon', 'sort_order', 'created_at', 'updated_at', 'exclude_from_average'],
  transactions: ['id', 'user_id', 'type', 'amount', 'category_id', 'note', 'occurred_at', 'created_at', 'updated_at', 'exclude_from_average'],
  obligations: ['id', 'user_id', 'name', 'category_id', 'payment_mode', 'monthly_amount', 'payment_day', 'first_payment_date', 'last_payment_date', 'created_at', 'updated_at'],
  obligation_payments: ['id', 'user_id', 'obligation_id', 'due_date', 'amount', 'transaction_id', 'created_at', 'updated_at'],
} as const;

type LocalRow = Record<string, SQLiteBindValue> & {
  id: string;
  user_id: string;
  remote_id: string | null;
  remote_updated_at: string | null;
  local_revision: number;
  sync_status: string;
};

const entityType = (table: SyncTable) => ({ categories: 'category', transactions: 'transaction', obligations: 'obligation', obligation_payments: 'obligation_payment' } as const)[table];
const tableForEntity = { category: 'categories', transaction: 'transactions', obligation: 'obligations', obligation_payment: 'obligation_payments' } as const;
const errorMessage = (error: unknown) => error instanceof Error
  ? error.message
  : 'Не удалось синхронизировать запись';

const toCloudRow = (table: SyncTable, row: LocalRow) => Object.fromEntries(
  columns[table].map(key => [key, key === 'exclude_from_average' ? row[key] === 1 : row[key]])
) as CloudRow;

const pushDeletions = async (database: SQLiteDatabase, remote: SyncRemote, userId: string) => {
  const deletions = await runLocalWrite(() => database.getAllAsync<LocalDeletion>(
    `select * from local_deletions where user_id = ? order by case entity_type when 'obligation_payment' then 0 when 'obligation' then 1 when 'transaction' then 2 else 3 end, deleted_at, entity_id;`,
    userId
  ));

  for (const deletion of deletions) {
    const table = tableForEntity[deletion.entity_type];
    const keys = [userId, deletion.entity_type, deletion.entity_id, deletion.revision];

    try {
      await remote.remove(table, deletion.remote_id ?? deletion.entity_id);
      await runLocalWrite(() => database.runAsync(
        'delete from local_deletions where user_id = ? and entity_type = ? and entity_id = ? and revision = ?;',
        ...keys
      ));
    } catch (error) {
      await runLocalWrite(() => database.runAsync(
        `update local_deletions set sync_status = 'failed', sync_error = ?
         where user_id = ? and entity_type = ? and entity_id = ? and revision = ?;`,
        errorMessage(error), ...keys
      ));
      throw error;
    }
  }
};

const pushRows = async (database: SQLiteDatabase, remote: SyncRemote, userId: string, table: SyncTable) => {
  const rows = await runLocalWrite(() => database.getAllAsync<LocalRow>(
    `select * from ${table} where user_id = ? and sync_status in ('pending', 'failed') order by ${table === 'obligation_payments' ? 'transaction_id is not null, ' : ''}id;`, userId
  ));

  for (const row of rows) {
    const context = await runLocalWrite(async () => {
      const current = await database.getFirstAsync<LocalRow>(`select * from ${table} where user_id = ? and id = ?;`, userId, row.id);
      if (!current || current.local_revision !== row.local_revision) return null;
      if (row.remote_id && row.remote_id !== row.id) throw new Error('Локальный и облачный ID записи различаются');
      let category: LocalRow | null = null;
      if ((table === 'transactions' || table === 'obligations') && row.category_id) {
        category = await database.getFirstAsync<LocalRow>('select * from categories where user_id = ? and id = ?;', userId, row.category_id);
        if (!category || category.sync_status !== 'synced') return null;
      }
      const dependencies: { table: SyncTable; row: LocalRow; category: LocalRow | null }[] = [];
      if (table === 'obligation_payments') {
        for (const [dependencyTable, key] of [['obligations', 'obligation_id'], ['transactions', 'transaction_id']] as const) {
          if (!row[key]) continue;
          const dependency = await database.getFirstAsync<LocalRow>(`select * from ${dependencyTable} where user_id = ? and id = ?;`, userId, row[key]);
          if (!dependency || dependency.sync_status !== 'synced') return null;
          const dependencyCategory = dependency.category_id ? await database.getFirstAsync<LocalRow>(
            'select * from categories where user_id = ? and id = ?;', userId, dependency.category_id
          ) : null;
          if (dependency.category_id && (!dependencyCategory || dependencyCategory.sync_status !== 'synced')) return null;
          dependencies.push({ table: dependencyTable, row: dependency, category: dependencyCategory });
        }
      }
      return { category, dependencies };
    });
    if (!context) continue;
    const { category, dependencies } = context;
    const payload = toCloudRow(table, row);

    try {
      if (category) {
        await remote.ensureCategory(toCloudRow('categories', category) as CloudCategory);
      }
      for (const dependency of dependencies) {
        if (dependency.category) await remote.ensureCategory(toCloudRow('categories', dependency.category) as CloudCategory);
        await remote.ensureRow(dependency.table, toCloudRow(dependency.table, dependency.row));
      }
      const saved = await remote.upsert(table, payload, row.remote_updated_at);
      await runLocalWrite(async () => {
        await database.runAsync(
          `update ${table} set remote_id = ?, remote_updated_at = ? where user_id = ? and id = ?;`,
          saved.id, saved.updated_at, userId, row.id
        );
        // A reply cannot acknowledge a newer local revision.
        await database.runAsync(
          `update ${table} set remote_id = ?, updated_at = ?, sync_status = 'synced', sync_error = null
           where user_id = ? and id = ? and local_revision = ?
            and not exists (select 1 from local_deletions where user_id = ? and entity_type = ? and entity_id = ?);`,
          saved.id, saved.updated_at, userId, row.id, row.local_revision, userId, entityType(table), row.id
        );
      });
    } catch (error) {
      await runLocalWrite(() => database.runAsync(
        `update ${table} set sync_status = 'failed', sync_error = ?
         where user_id = ? and id = ? and local_revision = ?;`,
        errorMessage(error), userId, row.id, row.local_revision
      ));
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
    if (table === 'transactions' || table === 'obligations') {
      const index = columns[table].indexOf('category_id');
      if (values[index] && !await database.getFirstAsync(
        'select id from categories where user_id = ? and id = ?;', userId, values[index]
      )) values[index] = null;
    }

    if (table === 'categories' && (row as CloudCategory).type !== 'expense' && await database.getFirstAsync(
      'select id from obligations where category_id = ?;', row.id
    )) {
      await database.runAsync("update categories set sync_status = 'pending', updated_at = ? where user_id = ? and id = ?;", new Date().toISOString(), userId, row.id);
      continue;
    }
    if (table === 'obligations' && await database.getFirstAsync(
      "select id from obligation_payments where obligation_id = ? and sync_status != 'synced';", row.id
    )) continue;
    if (table === 'obligation_payments') {
      const value = row as unknown as { obligation_id: string; due_date: string; transaction_id: string | null };
      const parent = await database.getFirstAsync<LocalRow>('select * from obligations where user_id = ? and id = ?;', userId, value.obligation_id);
      if (!parent || value.due_date < String(parent.first_payment_date) || value.due_date > String(parent.last_payment_date)) continue;
      if (await database.getFirstAsync("select id from obligation_payments where obligation_id = ? and substr(due_date, 1, 7) = ? and id != ?;", value.obligation_id, value.due_date.slice(0, 7), row.id)) continue;
      const transactionIndex = columns.obligation_payments.indexOf('transaction_id');
      if (value.transaction_id) {
        const transaction = await database.getFirstAsync<LocalRow>("select * from transactions where user_id = ? and id = ? and type = 'expense';", userId, value.transaction_id);
        if (!transaction) values[transactionIndex] = null;
        else if (await database.getFirstAsync('select id from obligation_payments where transaction_id = ? and id != ?;', value.transaction_id, row.id)) continue;
      }
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
    ? `and not exists (select 1 from transactions where category_id = categories.id and sync_status != 'synced')
       and not exists (select 1 from obligations where category_id = categories.id)`
    : table === 'transactions' ? `and not exists (select 1 from obligation_payments where transaction_id = transactions.id and sync_status != 'synced')` : '';

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

const hasObligationData = (database: SQLiteDatabase, userId: string) => database.getFirstAsync(`
  select id from obligations where user_id = ? union all select id from obligation_payments where user_id = ?
  union all select entity_id from local_deletions where user_id = ? and entity_type in ('obligation', 'obligation_payment') limit 1;
`, userId, userId, userId);

const validateSnapshot = (snapshot: SyncSnapshot, userId: string) => {
  if (!Array.isArray(snapshot.categories) || !Array.isArray(snapshot.transactions)
    || (snapshot.obligations !== undefined && !Array.isArray(snapshot.obligations))
    || (snapshot.obligation_payments !== undefined && !Array.isArray(snapshot.obligation_payments))
    || (snapshot.obligations === undefined) !== (snapshot.obligation_payments === undefined)
    || [...snapshot.categories, ...snapshot.transactions, ...snapshot.obligations ?? [], ...snapshot.obligation_payments ?? []]
      .some(row => !row || row.user_id !== userId || typeof row.id !== 'string')) {
    throw new Error('Некорректный снимок данных аккаунта');
  }
  const categories = new Map(snapshot.categories.map(row => [row.id, row]));
  const transactions = new Map(snapshot.transactions.map(row => [row.id, row]));
  const obligations = new Map((snapshot.obligations ?? []).map(row => [row.id, row]));
  const months = new Set<string>();
  const linkedExpenses = new Set<string>();
  for (const row of snapshot.obligations ?? []) {
    if (row.category_id && categories.get(row.category_id)?.type !== 'expense') throw new Error('Некорректная категория обязательства в снимке');
  }
  for (const row of snapshot.obligation_payments ?? []) {
    const parent = obligations.get(row.obligation_id);
    const month = `${row.obligation_id}:${row.due_date?.slice(0, 7)}`;
    if (!parent || typeof row.due_date !== 'string' || row.due_date < parent.first_payment_date || row.due_date > parent.last_payment_date
      || !Number.isFinite(row.amount) || row.amount <= 0 || months.has(month)
      || (row.transaction_id && (transactions.get(row.transaction_id)?.type !== 'expense' || linkedExpenses.has(row.transaction_id)))) {
      throw new Error('Некорректные связи платежей в снимке');
    }
    months.add(month);
    if (row.transaction_id) linkedExpenses.add(row.transaction_id);
  }
};

export const synchronizeDatabase = async (database: SQLiteDatabase, remote: SyncRemote, userId: string) => {
  if (!userId) throw new Error('Пользователь не выбран');
  const initialized = await database.getFirstAsync('select id from local_users where id = ?;', userId);
  const localData = await database.getFirstAsync(
    `select id from categories where user_id = ? union all select id from transactions where user_id = ?
     union all select entity_id from local_deletions where user_id = ? limit 1;`, userId, userId, userId
  ) || await hasObligationData(database, userId);
  await remote.initialize(!initialized && !localData);
  if (await hasObligationData(database, userId)) {
    const support = await remote.snapshot();
    validateSnapshot(support, userId);
    if (!support.obligations || !support.obligation_payments) throw new Error('Для синхронизации обязательств примените миграции Supabase');
  }
  for (let pass = 0; pass < 3; pass += 1) {
    await pushDeletions(database, remote, userId);
    for (const table of ['categories', 'transactions', 'obligations', 'obligation_payments'] as const) {
      await pushRows(database, remote, userId, table);
    }
    await pushDeletions(database, remote, userId);
    const dirty = await database.getFirstAsync(
      `select id from categories where user_id = ? and sync_status != 'synced'
       union all select id from transactions where user_id = ? and sync_status != 'synced'
       union all select id from obligations where user_id = ? and sync_status != 'synced'
       union all select id from obligation_payments where user_id = ? and sync_status != 'synced' limit 1;`,
      userId, userId, userId, userId
    );
    if (!dirty) break;
  }
  const snapshot = await remote.snapshot();
  validateSnapshot(snapshot, userId);
  if (!snapshot.obligations && await hasObligationData(database, userId)) throw new Error('Для синхронизации обязательств примените миграции Supabase');
  await withLocalTransaction(database, async db => {
    if (snapshot.obligations && snapshot.obligation_payments) {
      // Rebuild only clean schedule rows atomically: avoids month/link uniqueness and range races.
      // Dirty children retain their parents and survive a stale cloud snapshot.
      await db.runAsync("update obligation_payments set remote_deleted = 1 where user_id = ? and sync_status = 'synced';", userId);
      await db.runAsync("delete from obligation_payments where user_id = ? and sync_status = 'synced' and remote_deleted = 1;", userId);
      await db.runAsync(`update obligations set sync_status = 'pending', updated_at = ?
        where user_id = ? and sync_status = 'synced' and exists (
          select 1 from obligation_payments where obligation_id = obligations.id and sync_status != 'synced'
        );`, new Date().toISOString(), userId);
      await db.runAsync("update obligations set remote_deleted = 1 where user_id = ? and sync_status = 'synced';", userId);
      await db.runAsync("delete from obligations where user_id = ? and sync_status = 'synced' and remote_deleted = 1;", userId);
    }
    await removeMissingRows(db, userId, 'transactions', snapshot.transactions);
    await removeMissingRows(db, userId, 'categories', snapshot.categories);
    await pullRows(db, userId, 'categories', snapshot.categories);
    await pullRows(db, userId, 'transactions', snapshot.transactions);
    if (snapshot.obligations && snapshot.obligation_payments) {
      await pullRows(db, userId, 'obligations', snapshot.obligations);
      await pullRows(db, userId, 'obligation_payments', snapshot.obligation_payments);
    }
    const now = new Date().toISOString();
    await db.runAsync('insert or ignore into local_users (id, created_at, initialized_at) values (?, ?, ?);', userId, now, now);
  });
};
