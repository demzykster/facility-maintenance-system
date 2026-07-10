create table if not exists public.app_config (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  source_kv_key text not null default 'config:v1',
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_config_updated_at_idx on public.app_config (updated_at desc);
create index if not exists app_config_legacy_payload_gin_idx on public.app_config using gin (legacy_payload);

alter table public.app_config enable row level security;

drop policy if exists "app_config_admin_all" on public.app_config;
create policy "app_config_admin_all"
  on public.app_config
  for all
  using (public.cmms_is_admin())
  with check (public.cmms_is_admin());

drop policy if exists "app_config_settings_read" on public.app_config;
create policy "app_config_settings_read"
  on public.app_config
  for select
  using (public.cmms_has_permission('settings', 'view'));

drop policy if exists "app_config_settings_write" on public.app_config;
create policy "app_config_settings_write"
  on public.app_config
  for all
  using (public.cmms_has_permission('settings', 'manage'))
  with check (public.cmms_has_permission('settings', 'manage'));

drop trigger if exists app_config_touch_updated_at on public.app_config;
create trigger app_config_touch_updated_at
  before update on public.app_config
  for each row
  execute function public.cmms_touch_updated_at();

grant select, insert, update, delete on public.app_config to service_role;
