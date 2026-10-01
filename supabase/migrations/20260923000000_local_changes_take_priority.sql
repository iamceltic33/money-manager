-- Локальные pending/failed имеют приоритет при отправке.
-- expected_updated_at сохранён для совместимости уже установленных клиентов.
create or replace function public.apply_sync_change(entity_type text, payload jsonb, expected_updated_at timestamptz default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_category public.categories;
  next_category public.categories;
  current_transaction public.transactions;
  next_transaction public.transactions;
begin
  if auth.uid() is null or (payload->>'user_id')::uuid is distinct from auth.uid() then
    raise exception 'Invalid owner' using errcode = '42501';
  end if;
  if entity_type not in ('categories', 'transactions') then
    raise exception 'Invalid entity type';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(entity_type || ':' || (payload->>'id'), 0));

  if entity_type = 'categories' then
    next_category := jsonb_populate_record(null::public.categories, payload);
    select * into current_category from public.categories where id = next_category.id for update;
    if found then
      if (to_jsonb(current_category) - 'updated_at') = (to_jsonb(next_category) - 'updated_at') then
        return to_jsonb(current_category);
      end if;
      update public.categories set name = next_category.name, type = next_category.type,
        color = next_category.color, icon = next_category.icon, sort_order = next_category.sort_order,
        exclude_from_average = next_category.exclude_from_average
      where id = next_category.id returning * into current_category;
    else
      insert into public.categories (id, user_id, name, type, color, icon, sort_order, exclude_from_average, created_at)
      values (next_category.id, auth.uid(), next_category.name, next_category.type, next_category.color,
        next_category.icon, next_category.sort_order, next_category.exclude_from_average, next_category.created_at)
      returning * into current_category;
    end if;
    return to_jsonb(current_category);
  end if;

  next_transaction := jsonb_populate_record(null::public.transactions, payload);
  select * into current_transaction from public.transactions where id = next_transaction.id for update;
  if found then
    if (to_jsonb(current_transaction) - 'updated_at') = (to_jsonb(next_transaction) - 'updated_at') then
      return to_jsonb(current_transaction);
    end if;
    update public.transactions set type = next_transaction.type, amount = next_transaction.amount,
      category_id = next_transaction.category_id, note = next_transaction.note,
      occurred_at = next_transaction.occurred_at, exclude_from_average = next_transaction.exclude_from_average
    where id = next_transaction.id returning * into current_transaction;
  else
    insert into public.transactions (id, user_id, type, amount, category_id, note, occurred_at, created_at, exclude_from_average)
    values (next_transaction.id, auth.uid(), next_transaction.type, next_transaction.amount,
      next_transaction.category_id, next_transaction.note, next_transaction.occurred_at,
      next_transaction.created_at, next_transaction.exclude_from_average)
    returning * into current_transaction;
  end if;
  return to_jsonb(current_transaction);
end;
$$;

revoke all on function public.apply_sync_change(text, jsonb, timestamptz) from public, anon;
grant execute on function public.apply_sync_change(text, jsonb, timestamptz) to authenticated;
