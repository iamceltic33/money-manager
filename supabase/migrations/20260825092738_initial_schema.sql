create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'KZT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, type)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  month date not null,
  limit_amount numeric(14, 2) not null check (limit_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (month = date_trunc('month', month)::date)
);

create index categories_user_id_idx on public.categories(user_id);
create index transactions_user_id_idx on public.transactions(user_id);
create index transactions_category_id_idx on public.transactions(category_id);
create index transactions_occurred_at_idx on public.transactions(occurred_at);
create index budgets_user_id_idx on public.budgets(user_id);
create index budgets_category_id_idx on public.budgets(category_id);
create index budgets_month_idx on public.budgets(month);
create unique index budgets_user_category_month_idx
on public.budgets(user_id, category_id, month)
where category_id is not null;

create unique index budgets_user_month_without_category_idx
on public.budgets(user_id, month)
where category_id is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create trigger set_budgets_updated_at
before update on public.budgets
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');

  return new;
end;
$$;

create trigger create_profile_after_user_signup
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can delete own profile"
on public.profiles
for delete
to authenticated
using (auth.uid() = id);

create policy "Users can read own categories"
on public.categories
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own categories"
on public.categories
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own categories"
on public.categories
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own categories"
on public.categories
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own transactions"
on public.transactions
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own transactions"
on public.transactions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    category_id is null
    or exists (
      select 1
      from public.categories
      where categories.id = transactions.category_id
        and categories.user_id = auth.uid()
    )
  )
);

create policy "Users can update own transactions"
on public.transactions
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    category_id is null
    or exists (
      select 1
      from public.categories
      where categories.id = transactions.category_id
        and categories.user_id = auth.uid()
    )
  )
);

create policy "Users can delete own transactions"
on public.transactions
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own budgets"
on public.budgets
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own budgets"
on public.budgets
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    category_id is null
    or exists (
      select 1
      from public.categories
      where categories.id = budgets.category_id
        and categories.user_id = auth.uid()
    )
  )
);

create policy "Users can update own budgets"
on public.budgets
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    category_id is null
    or exists (
      select 1
      from public.categories
      where categories.id = budgets.category_id
        and categories.user_id = auth.uid()
    )
  )
);

create policy "Users can delete own budgets"
on public.budgets
for delete
to authenticated
using (auth.uid() = user_id);
