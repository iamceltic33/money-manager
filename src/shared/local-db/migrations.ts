import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

type UserVersionRow = {
  user_version: number;
};

export async function runLocalMigrations(database: SQLiteDatabase) {
  await database.execAsync('PRAGMA foreign_keys = ON;');

  const versionRow = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version;');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) return;

  if (currentVersion < 1) {
    await database.execAsync(`
      create table if not exists transactions (
        id text primary key not null,
        remote_id text,
        type text not null check (type in ('income', 'expense')),
        amount real not null check (amount > 0),
        category_id text,
        note text,
        occurred_at text not null,
        created_at text not null,
        updated_at text not null,
        sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
        sync_error text
      );

      create index if not exists transactions_type_idx
      on transactions(type);

      create index if not exists transactions_occurred_at_idx
      on transactions(occurred_at);

      create index if not exists transactions_sync_status_idx
      on transactions(sync_status);
    `);
  }

  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
}
