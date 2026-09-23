alter table public.profiles add column data_initialized_at timestamptz;

create function public.initialize_account_data(seed_defaults boolean default true)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  initialized_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;
  select data_initialized_at into initialized_at
  from public.profiles where id = auth.uid() for update;

  if initialized_at is not null then return; end if;

  if seed_defaults
    and not exists (select 1 from public.categories where user_id = auth.uid())
    and not exists (select 1 from public.transactions where user_id = auth.uid()) then
    insert into public.categories (user_id, name, type, color, icon, sort_order)
    values
      (auth.uid(), 'Зарплата', 'income', '#16A34A', 'salary', 10),
      (auth.uid(), 'Подарок', 'income', '#DB2777', 'gift', 20),
      (auth.uid(), 'Покупки', 'expense', '#DC2626', 'shopping', 10),
      (auth.uid(), 'Кредиты', 'expense', '#7C3AED', 'bank', 20),
      (auth.uid(), 'Платежи', 'expense', '#CA8A04', 'receipt', 30),
      (auth.uid(), 'Еда', 'expense', '#0EA5E9', 'food', 40),
      (auth.uid(), 'Транспорт', 'expense', '#2563EB', 'transport', 50);
  end if;

  update public.profiles set data_initialized_at = now() where id = auth.uid();
end;
$$;

-- Один SQL-снимок обеих таблиц: нет гонки между страницами и лимита REST в 1000 строк.
create function public.get_sync_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'categories', coalesce((select jsonb_agg(c order by c.id) from public.categories c where c.user_id = auth.uid()), '[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(t order by t.id) from public.transactions t where t.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

revoke all on function public.initialize_account_data(boolean) from public, anon;
revoke all on function public.get_sync_snapshot() from public, anon;
grant execute on function public.initialize_account_data(boolean) to authenticated;
grant execute on function public.get_sync_snapshot() to authenticated;
