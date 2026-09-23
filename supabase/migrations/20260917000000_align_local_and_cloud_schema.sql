alter table public.categories
  add column exclude_from_average boolean not null default false,
  add column sort_order integer not null default 0;

alter table public.transactions
  add column exclude_from_average boolean not null default false;

insert into public.profiles (id, display_name)
select id, raw_user_meta_data->>'display_name'
from auth.users
on conflict (id) do nothing;
