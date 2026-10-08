import type { SQLiteDatabase } from 'expo-sqlite';

// Runs inside the migration transaction. Dates are local calendar dates, not UTC instants.
export async function prepareObligationsSchema(database: SQLiteDatabase) {
  await database.execAsync(`
    create table if not exists obligations (
      id text primary key not null,
      user_id text not null check (length(trim(user_id)) > 0),
      remote_id text,
      name text not null check (length(trim(name)) > 0),
      category_id text references categories(id) on delete set null,
      payment_mode text not null check (payment_mode in ('fixed', 'manual')),
      monthly_amount real,
      payment_day integer,
      first_payment_date text not null check (
        first_payment_date between '0001-01-01' and '9999-12-31' and length(first_payment_date) = 10 and date(first_payment_date, '+0 days') is not null
        and date(first_payment_date, '+0 days') = first_payment_date
      ),
      last_payment_date text not null check (
        last_payment_date between '0001-01-01' and '9999-12-31' and length(last_payment_date) = 10 and date(last_payment_date, '+0 days') is not null
        and date(last_payment_date, '+0 days') = last_payment_date
        and last_payment_date >= first_payment_date
      ),
      created_at text not null,
      updated_at text not null,
      sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
      sync_error text,
      remote_updated_at text,
      local_revision integer not null default 0,
      remote_deleted integer not null default 0 check (remote_deleted in (0, 1)),
      check (
        (payment_mode = 'fixed' and monthly_amount is not null and monthly_amount > 0
          and monthly_amount <= 999999999999.99 and payment_day is not null
          and payment_day between 1 and 31 and payment_day = cast(payment_day as integer))
        or (payment_mode = 'manual' and monthly_amount is null and payment_day is null)
      ),
      unique (user_id, id)
    );

    create table if not exists obligation_payments (
      id text primary key not null,
      user_id text not null check (length(trim(user_id)) > 0),
      remote_id text,
      obligation_id text not null,
      due_date text not null check (
        due_date between '0001-01-01' and '9999-12-31' and length(due_date) = 10 and date(due_date, '+0 days') is not null
        and date(due_date, '+0 days') = due_date
      ),
      amount real not null check (amount > 0 and amount <= 999999999999.99),
      transaction_id text unique references transactions(id) on delete set null,
      created_at text not null,
      updated_at text not null,
      sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
      sync_error text,
      remote_updated_at text,
      local_revision integer not null default 0,
      remote_deleted integer not null default 0 check (remote_deleted in (0, 1)),
      foreign key (user_id, obligation_id) references obligations(user_id, id) on delete restrict
    );

    create index if not exists obligations_user_idx on obligations(user_id);
    create index if not exists obligations_category_idx on obligations(category_id);
    create index if not exists obligations_user_status_idx on obligations(user_id, sync_status);
    create index if not exists obligation_payments_user_due_idx on obligation_payments(user_id, due_date);
    create index if not exists obligation_payments_obligation_idx on obligation_payments(obligation_id);
    create index if not exists obligation_payments_user_status_idx on obligation_payments(user_id, sync_status);
    create unique index if not exists obligation_payments_month_idx
      on obligation_payments(obligation_id, substr(due_date, 1, 7));
  `);

  for (const operation of ['insert', 'update'] as const) {
    await database.execAsync(`
      create trigger if not exists obligations_validate_${operation}
      before ${operation} on obligations
      begin
        select raise(abort, 'Обязательство требует расходную категорию своего аккаунта')
        where new.category_id is not null and not exists (
          select 1 from categories where id = new.category_id and user_id = new.user_id and type = 'expense'
        );
        select raise(abort, 'Срок обязательства не включает существующие платежи')
        where exists (
          select 1 from obligation_payments where obligation_id = new.id
            and (due_date < new.first_payment_date or due_date > new.last_payment_date)
        );
      end;

      create trigger if not exists obligation_payments_validate_${operation}
      before ${operation} on obligation_payments
      begin
        select raise(abort, 'Платёж не входит в срок обязательства своего аккаунта')
        where not exists (
          select 1 from obligations where id = new.obligation_id and user_id = new.user_id
            and new.due_date between first_payment_date and last_payment_date
        );
        select raise(abort, 'Платёж требует расход своего аккаунта')
        where new.transaction_id is not null and not exists (
          select 1 from transactions where id = new.transaction_id and user_id = new.user_id and type = 'expense'
        );
      end;
    `);
  }

  for (const [table, fields] of [
    ['obligations', 'name, category_id, payment_mode, monthly_amount, payment_day, first_payment_date, last_payment_date, updated_at'],
    ['obligation_payments', 'obligation_id, due_date, amount, transaction_id, updated_at'],
  ] as const) {
    await database.execAsync(`
      create trigger if not exists ${table}_immutable_identity
      before update of id, user_id on ${table}
      when new.id is not old.id or new.user_id is not old.user_id
      begin
        select raise(abort, 'Нельзя менять ID или владельца обязательства/платежа');
      end;

      create trigger if not exists ${table}_track_revision
      after update of ${fields} on ${table}
      when new.sync_status = 'pending' and new.local_revision = old.local_revision
      begin
        update ${table} set local_revision = old.local_revision + 1, remote_deleted = 0 where id = new.id;
      end;
    `);
  }

  await database.execAsync(`
    create trigger if not exists categories_guard_obligations
    before update of id, user_id, type on categories
    when (new.id is not old.id or new.user_id is not old.user_id or new.type != 'expense')
      and exists (select 1 from obligations where category_id = old.id)
    begin
      select raise(abort, 'Категория связана с обязательством');
    end;

    create trigger if not exists transactions_guard_obligation_payments
    before update of id, user_id, type on transactions
    when (new.id is not old.id or new.user_id is not old.user_id or new.type != 'expense')
      and exists (select 1 from obligation_payments where transaction_id = old.id)
    begin
      select raise(abort, 'Операция связана с платежом обязательства');
    end;

    create trigger if not exists categories_detach_obligations
    before delete on categories
    begin
      update obligations set category_id = null,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        sync_status = case when old.remote_deleted = 0 then 'pending' else sync_status end,
        sync_error = null where category_id = old.id;
    end;

    create trigger if not exists transactions_detach_obligation_payments
    before delete on transactions
    begin
      update obligation_payments set transaction_id = null,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        sync_status = case when old.remote_deleted = 0 then 'pending' else sync_status end,
        sync_error = null where transaction_id = old.id;
    end;
  `);
}
