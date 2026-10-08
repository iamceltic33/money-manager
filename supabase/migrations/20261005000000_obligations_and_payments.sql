-- Schema foundation only. The sync RPCs still exchange categories/transactions.
create table public.obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  category_id uuid references public.categories(id) on delete set null,
  payment_mode text not null check (payment_mode in ('fixed', 'manual')),
  monthly_amount numeric(14, 2),
  payment_day integer,
  first_payment_date date not null check (first_payment_date between date '0001-01-01' and date '9999-12-31'),
  last_payment_date date not null check (last_payment_date between date '0001-01-01' and date '9999-12-31'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  check (last_payment_date >= first_payment_date),
  check (
    (payment_mode = 'fixed' and monthly_amount is not null and monthly_amount > 0
      and monthly_amount <= 999999999999.99 and payment_day is not null and payment_day between 1 and 31)
    or (payment_mode = 'manual' and monthly_amount is null and payment_day is null)
  )
);

create table public.obligation_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  obligation_id uuid not null,
  due_date date not null check (due_date between date '0001-01-01' and date '9999-12-31'),
  amount numeric(14, 2) not null check (amount > 0 and amount <= 999999999999.99),
  transaction_id uuid unique references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, obligation_id) references public.obligations(user_id, id) on delete restrict
);

create index obligations_user_idx on public.obligations(user_id);
create index obligations_category_idx on public.obligations(category_id);
create index obligation_payments_user_due_idx on public.obligation_payments(user_id, due_date);
create index obligation_payments_obligation_idx on public.obligation_payments(obligation_id);
create unique index obligation_payments_month_idx on public.obligation_payments
  (obligation_id, extract(year from due_date), extract(month from due_date));

create function public.validate_obligation()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.id != old.id or new.user_id != old.user_id) then
    raise exception 'Obligation identity cannot change' using errcode = '23514';
  end if;
  if new.category_id is not null then
    perform 1 from public.categories where id = new.category_id
      and user_id = new.user_id and type = 'expense' for share;
    if not found then
      raise exception 'Obligation requires an expense category of the same account' using errcode = '23514';
    end if;
  end if;
  if exists (select 1 from public.obligation_payments where obligation_id = new.id
    and (due_date < new.first_payment_date or due_date > new.last_payment_date)) then
    raise exception 'Existing payments fall outside the obligation period' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.validate_obligation_payment()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.id != old.id or new.user_id != old.user_id) then
    raise exception 'Payment identity cannot change' using errcode = '23514';
  end if;
  perform 1 from public.obligations where id = new.obligation_id and user_id = new.user_id
    and new.due_date between first_payment_date and last_payment_date for share;
  if not found then
    raise exception 'Payment requires a matching account and obligation period' using errcode = '23514';
  end if;
  if new.transaction_id is not null then
    perform 1 from public.transactions where id = new.transaction_id
      and user_id = new.user_id and type = 'expense' for share;
    if not found then
      raise exception 'Payment requires an expense of the same account' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create function public.guard_obligation_category()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if (new.id != old.id or new.user_id != old.user_id or new.type != 'expense')
    and exists (select 1 from public.obligations where category_id = old.id) then
    raise exception 'Category is linked to an obligation' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.guard_obligation_transaction()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if (new.id != old.id or new.user_id != old.user_id or new.type != 'expense')
    and exists (select 1 from public.obligation_payments where transaction_id = old.id) then
    raise exception 'Transaction is linked to an obligation payment' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger obligations_validate before insert or update on public.obligations
  for each row execute function public.validate_obligation();
create trigger obligation_payments_validate before insert or update on public.obligation_payments
  for each row execute function public.validate_obligation_payment();
create trigger categories_guard_obligations before update of id, user_id, type on public.categories
  for each row execute function public.guard_obligation_category();
create trigger transactions_guard_obligation_payments before update of id, user_id, type on public.transactions
  for each row execute function public.guard_obligation_transaction();
create trigger set_obligations_updated_at before update on public.obligations
  for each row execute function public.set_updated_at();
create trigger set_obligation_payments_updated_at before update on public.obligation_payments
  for each row execute function public.set_updated_at();

alter table public.obligations enable row level security;
alter table public.obligation_payments enable row level security;
create policy "Users manage own obligations" on public.obligations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own obligation payments" on public.obligation_payments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.obligations, public.obligation_payments from anon;
grant select, insert, update, delete on public.obligations, public.obligation_payments to authenticated;
revoke all on function public.validate_obligation(), public.validate_obligation_payment(),
  public.guard_obligation_category(), public.guard_obligation_transaction() from public, anon;
