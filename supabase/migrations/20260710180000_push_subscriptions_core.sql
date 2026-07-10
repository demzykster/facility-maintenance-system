create table if not exists public.push_subscriptions (
  id text primary key,
  user_id text not null default '',
  user_name text not null default '',
  user_role text not null default '',
  user_permissions jsonb not null default '{}'::jsonb,
  user_cleaning_access jsonb not null default 'false'::jsonb,
  notification_prefs jsonb not null default '{}'::jsonb,
  endpoint text not null default '',
  subscription jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  legacy_payload jsonb not null default '{}'::jsonb
);

create unique index if not exists push_subscriptions_endpoint_idx on public.push_subscriptions(endpoint);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index if not exists push_subscriptions_updated_at_idx on public.push_subscriptions(updated_at desc);
create index if not exists push_subscriptions_legacy_payload_gin_idx on public.push_subscriptions using gin (legacy_payload);

grant select, insert, update, delete on public.push_subscriptions to service_role;

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.cmms_touch_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_admin_all on public.push_subscriptions;
create policy push_subscriptions_admin_all on public.push_subscriptions
for all to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists push_subscriptions_self_read on public.push_subscriptions;
create policy push_subscriptions_self_read on public.push_subscriptions
for select to authenticated
using (user_id = public.cmms_current_app_user_id()::text);

drop policy if exists push_subscriptions_self_write on public.push_subscriptions;
create policy push_subscriptions_self_write on public.push_subscriptions
for all to authenticated
using (user_id = public.cmms_current_app_user_id()::text)
with check (user_id = public.cmms_current_app_user_id()::text);
