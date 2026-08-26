create or replace function public.get_current_balance()
returns numeric(14, 2)
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    sum(
      case
        when transactions.type = 'income' then transactions.amount
        when transactions.type = 'expense' then -transactions.amount
        else 0
      end
    ),
    0
  )::numeric(14, 2)
  from public.transactions
  where transactions.user_id = auth.uid();
$$;

revoke all on function public.get_current_balance() from public;
grant execute on function public.get_current_balance() to authenticated;
