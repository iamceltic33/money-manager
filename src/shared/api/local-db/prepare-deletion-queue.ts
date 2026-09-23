import type { SQLiteDatabase } from 'expo-sqlite';

export const prepareDeletionQueue = async (database: SQLiteDatabase) => {
  await database.execAsync(`
    create table local_deletions (
      user_id text not null,
      entity_type text not null check (entity_type in ('category', 'transaction')),
      entity_id text not null,
      remote_id text,
      deleted_at text not null,
      sync_status text not null default 'pending' check (sync_status in ('pending', 'failed')),
      sync_error text,
      primary key (user_id, entity_type, entity_id)
    );

    create index local_deletions_user_status_idx
    on local_deletions(user_id, sync_status);
  `);

  for (const [table, entityType] of [
    ['categories', 'category'],
    ['transactions', 'transaction'],
  ] as const) {
    await database.execAsync(`
      create trigger ${table}_track_deletion
      before delete on ${table}
      when old.user_id is not null
      begin
        insert into local_deletions (
          user_id, entity_type, entity_id, remote_id, deleted_at, sync_status, sync_error
        )
        values (
          old.user_id, '${entityType}', old.id, old.remote_id,
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'pending', null
        )
        on conflict (user_id, entity_type, entity_id) do update set
          remote_id = excluded.remote_id,
          deleted_at = excluded.deleted_at,
          sync_status = 'pending',
          sync_error = null;
      end;
    `);
  }

  await database.execAsync(`
    create trigger categories_detach_transactions
    before delete on categories
    begin
      update transactions
      set category_id = null,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          sync_status = 'pending',
          sync_error = null
      where category_id = old.id;
    end;
  `);
};
