-- Minimal auth stand-in for migration/RLS tests in a NEW disposable PostgreSQL cluster.
-- Do not run this fixture against Supabase or an existing database.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth, public to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
