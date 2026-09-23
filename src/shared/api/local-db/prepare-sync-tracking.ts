import type { SQLiteDatabase } from 'expo-sqlite';

export const prepareSyncTracking = async (database: SQLiteDatabase) => {
  for (const table of ['categories', 'transactions'] as const) {
    await database.execAsync(`
      alter table ${table} add column remote_updated_at text;
      update ${table} set remote_updated_at = updated_at where sync_status = 'synced';
      alter table ${table} add column local_revision integer not null default 0;
      alter table ${table} add column remote_deleted integer not null default 0;

      create trigger ${table}_track_revision
      after update of ${table === 'categories'
        ? 'name, type, color, icon, sort_order, exclude_from_average, updated_at'
        : 'type, amount, category_id, note, occurred_at, exclude_from_average, updated_at'} on ${table}
      when new.sync_status = 'pending' and new.local_revision = old.local_revision
      begin
        update ${table} set local_revision = old.local_revision + 1, remote_deleted = 0
        where id = new.id;
      end;

      drop trigger ${table}_track_deletion;
      create trigger ${table}_track_deletion
      before delete on ${table}
      when old.user_id is not null and old.remote_deleted = 0
      begin
        insert into local_deletions (
          user_id, entity_type, entity_id, remote_id, deleted_at, sync_status, sync_error
        ) values (
          old.user_id, '${table === 'categories' ? 'category' : 'transaction'}', old.id,
          old.remote_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'pending', null
        ) on conflict (user_id, entity_type, entity_id) do update set
          remote_id = excluded.remote_id, deleted_at = excluded.deleted_at,
          sync_status = 'pending', sync_error = null, revision = revision + 1;
      end;
    `);
  }

  await database.execAsync(`
    alter table local_deletions add column revision integer not null default 0;

    drop trigger categories_detach_transactions;
    create trigger categories_detach_transactions
    before delete on categories
    when old.remote_deleted = 0
    begin
      update transactions set category_id = null,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        sync_status = 'pending', sync_error = null
      where category_id = old.id;
    end;

    drop trigger categories_unique_name_insert;
    create trigger categories_unique_name_insert
    before insert on categories
    when exists (
      select 1 from categories where user_id = new.user_id and name = new.name
        and type = new.type and id != new.id
    )
    begin
      select raise(abort, 'Категория с таким названием и типом уже существует');
    end;
  `);
};
