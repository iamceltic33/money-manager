import type { SQLiteDatabase } from 'expo-sqlite';

export async function prepareObligationsSync(database: SQLiteDatabase) {
  await database.execAsync(`
    drop trigger categories_track_deletion;
    drop trigger transactions_track_deletion;
    drop trigger if exists obligations_track_deletion;
    drop trigger if exists obligation_payments_track_deletion;
    create table local_deletions_next (
      user_id text not null,
      entity_type text not null check (entity_type in ('category', 'transaction', 'obligation', 'obligation_payment')),
      entity_id text not null,
      remote_id text,
      deleted_at text not null,
      sync_status text not null default 'pending' check (sync_status in ('pending', 'failed')),
      sync_error text,
      revision integer not null default 0,
      primary key (user_id, entity_type, entity_id)
    );
    insert into local_deletions_next select * from local_deletions;
    drop table local_deletions;
    alter table local_deletions_next rename to local_deletions;
    create index local_deletions_user_status_idx on local_deletions(user_id, sync_status);
  `);
  for (const [table, entity] of [['categories', 'category'], ['transactions', 'transaction'], ['obligations', 'obligation'], ['obligation_payments', 'obligation_payment']] as const) {
    await database.execAsync(`
      create trigger ${table}_track_deletion before delete on ${table}
      when old.user_id is not null and old.remote_deleted = 0
      begin
        insert into local_deletions (user_id, entity_type, entity_id, remote_id, deleted_at, sync_status, sync_error)
        values (old.user_id, '${entity}', old.id, old.remote_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'pending', null)
        on conflict (user_id, entity_type, entity_id) do update set
          remote_id = excluded.remote_id, deleted_at = excluded.deleted_at,
          sync_status = 'pending', sync_error = null, revision = revision + 1;
      end;
    `);
  }
}
