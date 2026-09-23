import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

type LocalIdRow = {
  id: string;
  remote_id: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Вызывается внутри транзакции миграции вместе с обновлением user_version.
export const prepareLocalSyncSchema = async (database: SQLiteDatabase) => {
  await database.execAsync('PRAGMA defer_foreign_keys = ON;');

  for (const table of ['categories', 'transactions'] as const) {
    const rows = await database.getAllAsync<LocalIdRow>(`select id, remote_id from ${table};`);

    for (const row of rows) {
      if (UUID_PATTERN.test(row.id)) continue;

      const id = row.remote_id && UUID_PATTERN.test(row.remote_id)
        ? row.remote_id
        : randomUUID();

      await database.runAsync(`update ${table} set id = ? where id = ?;`, id, row.id);

      if (table === 'categories') {
        await database.runAsync(
          'update transactions set category_id = ? where category_id = ?;',
          id,
          row.id
        );
      }
    }
  }

  // Старые дубли остаются доступны для ручного исправления. Новые запрещены,
  // в том числе при записи в обход API. NULL user_id повторяет поведение UNIQUE в PostgreSQL.
  await database.execAsync(`
    create index categories_user_name_type_idx on categories(user_id, name, type);

    create trigger categories_unique_name_insert
    before insert on categories
    when exists (
      select 1 from categories
      where user_id = new.user_id and name = new.name and type = new.type
    )
    begin
      select raise(abort, 'Категория с таким названием и типом уже существует');
    end;

    create trigger categories_unique_name_update
    before update of user_id, name, type on categories
    when (old.user_id is not new.user_id or old.name is not new.name or old.type is not new.type)
      and exists (
        select 1 from categories
        where user_id = new.user_id and name = new.name and type = new.type and id != old.id
      )
    begin
      select raise(abort, 'Категория с таким названием и типом уже существует');
    end;
  `);

  const foreignKeyError = await database.getFirstAsync('PRAGMA foreign_key_check;');

  if (foreignKeyError) {
    throw new Error('Не удалось обновить локальную базу: нарушены связи категорий и операций');
  }
};
