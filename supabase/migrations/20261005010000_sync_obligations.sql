alter function public.apply_sync_change(text, jsonb, timestamptz) rename to apply_base_sync_change;
revoke all on function public.apply_base_sync_change(text, jsonb, timestamptz) from public, anon;
grant execute on function public.apply_base_sync_change(text, jsonb, timestamptz) to authenticated;

create function public.apply_sync_change(entity_type text, payload jsonb, expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  current_obligation public.obligations;
  next_obligation public.obligations;
  current_payment public.obligation_payments;
  next_payment public.obligation_payments;
begin
  if auth.uid() is null or (payload->>'user_id')::uuid is distinct from auth.uid() then
    raise exception 'Invalid owner' using errcode = '42501';
  end if;
  if entity_type in ('categories', 'transactions') then
    return public.apply_base_sync_change(entity_type, payload, expected_updated_at);
  end if;
  if entity_type is null or entity_type not in ('obligations', 'obligation_payments') then
    raise exception 'Invalid entity type';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(entity_type || ':' || (payload->>'id'), 0));
  if entity_type = 'obligations' then
    next_obligation := jsonb_populate_record(null::public.obligations, payload);
    select * into current_obligation from public.obligations where id = next_obligation.id for update;
    if found then
      if (to_jsonb(current_obligation) - 'updated_at') = (to_jsonb(next_obligation) - 'updated_at') then
        return to_jsonb(current_obligation);
      end if;
      update public.obligations set name = next_obligation.name, category_id = next_obligation.category_id,
        payment_mode = next_obligation.payment_mode, monthly_amount = next_obligation.monthly_amount,
        payment_day = next_obligation.payment_day, first_payment_date = next_obligation.first_payment_date,
        last_payment_date = next_obligation.last_payment_date
      where id = next_obligation.id returning * into current_obligation;
    else
      insert into public.obligations (id, user_id, name, category_id, payment_mode, monthly_amount, payment_day,
        first_payment_date, last_payment_date, created_at)
      values (next_obligation.id, auth.uid(), next_obligation.name, next_obligation.category_id,
        next_obligation.payment_mode, next_obligation.monthly_amount, next_obligation.payment_day,
        next_obligation.first_payment_date, next_obligation.last_payment_date, next_obligation.created_at)
      returning * into current_obligation;
    end if;
    return to_jsonb(current_obligation);
  end if;
  next_payment := jsonb_populate_record(null::public.obligation_payments, payload);
  select * into current_payment from public.obligation_payments where id = next_payment.id for update;
  if found then
    if (to_jsonb(current_payment) - 'updated_at') = (to_jsonb(next_payment) - 'updated_at') then
      return to_jsonb(current_payment);
    end if;
    update public.obligation_payments set obligation_id = next_payment.obligation_id,
      due_date = next_payment.due_date, amount = next_payment.amount, transaction_id = next_payment.transaction_id
    where id = next_payment.id returning * into current_payment;
  else
    insert into public.obligation_payments (id, user_id, obligation_id, due_date, amount, transaction_id, created_at)
    values (next_payment.id, auth.uid(), next_payment.obligation_id, next_payment.due_date,
      next_payment.amount, next_payment.transaction_id, next_payment.created_at)
    returning * into current_payment;
  end if;
  return to_jsonb(current_payment);
end;
$$;
revoke all on function public.apply_sync_change(text, jsonb, timestamptz) from public, anon;
grant execute on function public.apply_sync_change(text, jsonb, timestamptz) to authenticated;

create or replace function public.get_sync_snapshot()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'categories', coalesce((select jsonb_agg(c order by c.id) from public.categories c where c.user_id = auth.uid()), '[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(t order by t.id) from public.transactions t where t.user_id = auth.uid()), '[]'::jsonb),
    'obligations', coalesce((select jsonb_agg(o order by o.id) from public.obligations o where o.user_id = auth.uid()), '[]'::jsonb),
    'obligation_payments', coalesce((select jsonb_agg(p order by p.id) from public.obligation_payments p where p.user_id = auth.uid()), '[]'::jsonb)
  );
$$;
revoke all on function public.get_sync_snapshot() from public, anon;
grant execute on function public.get_sync_snapshot() to authenticated;

-- Local deletion wins, including children added remotely since the previous snapshot.
-- Actual expenses are retained; only the selected account's schedule is deleted.
create function public.remove_sync_obligation(obligation_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1 from public.obligations where id = obligation_id and user_id = auth.uid() for update;
  delete from public.obligation_payments where user_id = auth.uid() and obligation_payments.obligation_id = remove_sync_obligation.obligation_id;
  delete from public.obligations where user_id = auth.uid() and id = obligation_id;
end;
$$;
revoke all on function public.remove_sync_obligation(uuid) from public, anon;
grant execute on function public.remove_sync_obligation(uuid) to authenticated;

create or replace function public.initialize_account_data(seed_defaults boolean default true)
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
    and not exists (select 1 from public.transactions where user_id = auth.uid())
    and not exists (select 1 from public.obligations where user_id = auth.uid()) then
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
