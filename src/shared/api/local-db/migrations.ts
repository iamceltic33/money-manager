import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 4;

type UserVersionRow = {
  user_version: number;
};

type TableRow = {
  name: string;
};

type TableInfoRow = {
  name: string;
};

export async function runLocalMigrations(database: SQLiteDatabase) {
  await database.execAsync('PRAGMA foreign_keys = ON;');

  const versionRow = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version;');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    await ensureUserScopedSchema(database);
    return;
  }

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

  await ensureUserScopedSchema(database);

  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
}

async function ensureUserScopedSchema(database: SQLiteDatabase) {
  await database.execAsync(`
    create table if not exists local_users (
      id text primary key not null,
      created_at text not null,
      initialized_at text not null
    );
  `);

  if (await tableExists(database, 'categories')) {
    if (!(await columnExists(database, 'categories', 'user_id'))) {
      await database.execAsync('alter table categories add column user_id text;');
    }

    await database.execAsync(`
      create index if not exists categories_user_id_idx
      on categories(user_id);

      create index if not exists categories_user_type_idx
      on categories(user_id, type);

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

  if (await tableExists(database, 'transactions')) {
    if (!(await columnExists(database, 'transactions', 'user_id'))) {
      await database.execAsync('alter table transactions add column user_id text;');
    }

    await database.execAsync(`
      create index if not exists transactions_user_id_idx
      on transactions(user_id);

      create index if not exists transactions_user_occurred_at_idx
      on transactions(user_id, occurred_at);
    `);
  }
}

async function tableExists(database: SQLiteDatabase, tableName: string) {
  const table = await database.getFirstAsync<TableRow>(
    `
      select name
      from sqlite_master
      where type = 'table' and name = ?;
    `,
    tableName
  );

  return Boolean(table);
}

async function columnExists(database: SQLiteDatabase, tableName: string, columnName: string) {
  const columns = await database.getAllAsync<TableInfoRow>(`PRAGMA table_info(${tableName});`);

  return columns.some((column) => column.name === columnName);
}
