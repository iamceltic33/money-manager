-- Run after all migrations in a disposable PostgreSQL database with Supabase auth roles.
-- All fixture records and helper functions are rolled back.
begin;

create function pg_temp.expect_error(statement text, expected_state text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE % for: %', expected_state, statement;
end;
$$;

insert into auth.users(id) values
  ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.categories(id, user_id, name, type) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Loan', 'expense'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Loan', 'expense'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Salary', 'income');
insert into public.transactions(id, user_id, type, amount) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'expense', 75),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'expense', 75),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'income', 200);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.obligations(id, user_id, name, category_id, payment_mode, monthly_amount,
  payment_day, first_payment_date, last_payment_date) values
  ('30000000-0000-0000-0000-000000000001', auth.uid(), 'Fixed loan',
   '10000000-0000-0000-0000-000000000001', 'fixed', 75, 31, '2026-10-01', '2027-03-31'),
  ('30000000-0000-0000-0000-000000000002', auth.uid(), 'Manual loan',
   null, 'manual', null, null, '2026-10-01', '2027-03-31');
insert into public.obligation_payments(id, user_id, obligation_id, due_date, amount, transaction_id) values
  ('40000000-0000-0000-0000-000000000001', auth.uid(), '30000000-0000-0000-0000-000000000001', '2026-10-31', 75, '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', auth.uid(), '30000000-0000-0000-0000-000000000002', '2026-10-15', 80.25, null),
  ('40000000-0000-0000-0000-000000000003', auth.uid(), '30000000-0000-0000-0000-000000000002', '2026-11-15', 110, null);

select pg_temp.expect_error($q$update public.obligations set monthly_amount = 0 where payment_mode = 'fixed'$q$, '23514');
select pg_temp.expect_error($q$update public.obligations set monthly_amount = null where payment_mode = 'fixed'$q$, '23514');
select pg_temp.expect_error($q$update public.obligations set monthly_amount = 1 where payment_mode = 'manual'$q$, '23514');
select pg_temp.expect_error($q$update public.obligations set payment_day = 32 where payment_mode = 'fixed'$q$, '23514');
select pg_temp.expect_error($q$update public.obligations set first_payment_date = '2026-02-30'$q$, '22008');
select pg_temp.expect_error($q$update public.obligations set last_payment_date = '2026-09-30'$q$, '23514');
select pg_temp.expect_error($q$update public.obligations set category_id = '10000000-0000-0000-0000-000000000002'$q$, '23514');
select pg_temp.expect_error($q$update public.obligations set category_id = '10000000-0000-0000-0000-000000000003'$q$, '23514');
select pg_temp.expect_error($q$update public.obligation_payments set due_date = '2027-04-01'$q$, '23514');
select pg_temp.expect_error($q$update public.obligation_payments set due_date = '2026-10-20' where id = '40000000-0000-0000-0000-000000000003'$q$, '23505');
select pg_temp.expect_error($q$update public.obligation_payments set amount = 0$q$, '23514');
select pg_temp.expect_error($q$update public.obligation_payments set transaction_id = '20000000-0000-0000-0000-000000000001' where id = '40000000-0000-0000-0000-000000000002'$q$, '23505');
select pg_temp.expect_error($q$update public.obligation_payments set transaction_id = '20000000-0000-0000-0000-000000000002'$q$, '23514');
select pg_temp.expect_error($q$update public.obligation_payments set transaction_id = '20000000-0000-0000-0000-000000000003'$q$, '23514');
select pg_temp.expect_error($q$update public.transactions set type = 'income' where id = '20000000-0000-0000-0000-000000000001'$q$, '23514');
select pg_temp.expect_error($q$update public.categories set type = 'income' where id = '10000000-0000-0000-0000-000000000001'$q$, '23514');
select pg_temp.expect_error($q$update public.obligations set user_id = '00000000-0000-0000-0000-000000000002'$q$, '23514');
select pg_temp.expect_error($q$update public.obligation_payments set user_id = '00000000-0000-0000-0000-000000000002'$q$, '23514');
select pg_temp.expect_error($q$delete from public.obligations where id = '30000000-0000-0000-0000-000000000001'$q$, '23503');

-- Another account cannot read, change or attach to the first account's schedule.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$ begin
  if exists (select 1 from public.obligations) or exists (select 1 from public.obligation_payments) then
    raise exception 'RLS leaked account data';
  end if;
  update public.obligations set name = 'Intrusion';
  if found then raise exception 'RLS allowed a foreign update'; end if;
  delete from public.obligation_payments;
  if found then raise exception 'RLS allowed a foreign delete'; end if;
end $$;
select pg_temp.expect_error($q$insert into public.obligations
  (user_id, name, payment_mode, first_payment_date, last_payment_date)
  values ('00000000-0000-0000-0000-000000000001', 'Intrusion', 'manual', '2026-10-01', '2027-03-31')$q$, '42501');
select pg_temp.expect_error($q$insert into public.obligation_payments (user_id, obligation_id, due_date, amount)
  values (auth.uid(), '30000000-0000-0000-0000-000000000001', '2026-12-31', 10)$q$, '23514');
set local role anon;
select pg_temp.expect_error('select * from public.obligations', '42501');
select pg_temp.expect_error('select * from public.obligation_payments', '42501');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
delete from public.categories where id = '10000000-0000-0000-0000-000000000001';
delete from public.transactions where id = '20000000-0000-0000-0000-000000000001';
do $$ begin
  if (select category_id from public.obligations where id = '30000000-0000-0000-0000-000000000001') is not null then
    raise exception 'Category deletion did not detach obligation';
  end if;
  if (select transaction_id from public.obligation_payments where id = '40000000-0000-0000-0000-000000000001') is not null then
    raise exception 'Expense deletion did not reopen payment';
  end if;
  if (select count(*) from public.obligation_payments) != 3 then raise exception 'Payments were lost'; end if;
end $$;
reset role;
-- Account deletion must still cascade all account data.
delete from auth.users where id = '00000000-0000-0000-0000-000000000001';
do $$ begin
  if exists (select 1 from public.obligations) or exists (select 1 from public.obligation_payments) then
    raise exception 'Account deletion left obligations/payments';
  end if;
end $$;
-- Also test account cascade while category, expense and paid link are all still present.
insert into public.obligations(id, user_id, name, category_id, payment_mode, first_payment_date, last_payment_date)
values ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002',
  'Second account', '10000000-0000-0000-0000-000000000002', 'manual', '2026-10-01', '2026-12-31');
insert into public.obligation_payments(user_id, obligation_id, due_date, amount, transaction_id)
values ('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003',
  '2026-10-31', 75, '20000000-0000-0000-0000-000000000002');
delete from auth.users where id = '00000000-0000-0000-0000-000000000002';
do $$ begin
  if exists (select 1 from public.obligations) or exists (select 1 from public.obligation_payments) then
    raise exception 'Account deletion with paid links failed';
  end if;
end $$;
rollback;
