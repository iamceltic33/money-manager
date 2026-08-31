import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 4;

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

  if (currentVersion < 2) {
    await database.execAsync(`
      create table if not exists categories (
        id text primary key not null,
        remote_id text,
        type text not null check (type in ('income', 'expense')),
        name text not null,
        color text,
        icon text,
        sort_order integer not null default 0,
        created_at text not null,
        updated_at text not null,
        sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
        sync_error text
      );

      create unique index if not exists categories_remote_id_idx
      on categories(remote_id)
      where remote_id is not null;

      create index if not exists categories_type_idx
      on categories(type);

      create index if not exists categories_sort_order_idx
      on categories(sort_order);

      create index if not exists categories_sync_status_idx
      on categories(sync_status);
    `);

    await database.execAsync('PRAGMA foreign_keys = OFF;');

    await database.execAsync(`
      alter table transactions rename to transactions_old;

      create table transactions (
        id text primary key not null,
        remote_id text,
        type text not null check (type in ('income', 'expense')),
        amount real not null check (amount > 0),
        category_id text references categories(id) on delete set null,
        note text,
        occurred_at text not null,
        created_at text not null,
        updated_at text not null,
        sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
        sync_error text
      );

      insert into transactions (
        id,
        remote_id,
        type,
        amount,
        category_id,
        note,
        occurred_at,
        created_at,
        updated_at,
        sync_status,
        sync_error
      )
      select
        id,
        remote_id,
        type,
        amount,
        null,
        note,
        occurred_at,
        created_at,
        updated_at,
        sync_status,
        sync_error
      from transactions_old;

      drop table transactions_old;

      create index if not exists transactions_type_idx
      on transactions(type);

      create index if not exists transactions_category_id_idx
      on transactions(category_id);

      create index if not exists transactions_occurred_at_idx
      on transactions(occurred_at);

      create index if not exists transactions_sync_status_idx
      on transactions(sync_status);
    `);

    await database.execAsync('PRAGMA foreign_keys = ON;');
  }

  if (currentVersion < 3) {
    await database.execAsync(`
      alter table categories add column user_id text;
      alter table transactions add column user_id text;

      create index if not exists categories_user_id_idx
      on categories(user_id);

      create index if not exists categories_user_type_idx
      on categories(user_id, type);

      create index if not exists transactions_user_id_idx
      on transactions(user_id);

      create index if not exists transactions_user_occurred_at_idx
      on transactions(user_id, occurred_at);
    `);
  }

  if (currentVersion < 4) {
    await database.execAsync(`
      create table if not exists local_users (
        id text primary key not null,
        created_at text not null,
        initialized_at text not null
      );

      insert or ignore into local_users (
        id,
        created_at,
        initialized_at
      )
      select distinct
        user_id,
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      from categories
      where user_id is not null;
    `);
  }

  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
}
