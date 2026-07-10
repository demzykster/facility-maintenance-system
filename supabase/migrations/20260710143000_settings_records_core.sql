create table if not exists public.locations (
  id text primary key,
  name text not null default '',
  type text not null default 'general',
  building text not null default '',
  floor text not null default '',
  area text not null default '',
  parent_id text,
  active boolean not null default true,
  tags jsonb not null default '[]'::jsonb,
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists locations_active_idx on public.locations(active);
create index if not exists locations_name_idx on public.locations(name);
create index if not exists locations_type_idx on public.locations(type);
create index if not exists locations_legacy_payload_gin_idx on public.locations using gin (legacy_payload);

create table if not exists public.app_issue_reports (
  id text primary key,
  status text not null default 'open',
  description text not null default '',
  reporter_id text not null default '',
  reporter_name text not null default '',
  reporter_role text not null default '',
  location text not null default '',
  screenshot_context jsonb not null default '{}'::jsonb,
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists app_issue_reports_status_idx on public.app_issue_reports(status);
create index if not exists app_issue_reports_reported_at_idx on public.app_issue_reports(reported_at desc);
create index if not exists app_issue_reports_reporter_id_idx on public.app_issue_reports(reporter_id);
create index if not exists app_issue_reports_legacy_payload_gin_idx on public.app_issue_reports using gin (legacy_payload);

grant select, insert, update, delete on public.locations to service_role;
grant select, insert, update, delete on public.app_issue_reports to service_role;

drop trigger if exists locations_touch_updated_at on public.locations;
create trigger locations_touch_updated_at
before update on public.locations
for each row execute function public.cmms_touch_updated_at();

drop trigger if exists app_issue_reports_touch_updated_at on public.app_issue_reports;
create trigger app_issue_reports_touch_updated_at
before update on public.app_issue_reports
for each row execute function public.cmms_touch_updated_at();

alter table public.locations enable row level security;
alter table public.app_issue_reports enable row level security;

drop policy if exists locations_admin_all on public.locations;
create policy locations_admin_all on public.locations
for all to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists locations_active_read on public.locations;
create policy locations_active_read on public.locations
for select to authenticated
using (public.cmms_current_role() in ('user', 'tech', 'worker', 'cleaner'));

drop policy if exists locations_manage on public.locations;
create policy locations_manage on public.locations
for all to authenticated
using (public.cmms_has_permission('settings', 'manage'))
with check (public.cmms_has_permission('settings', 'manage'));

drop policy if exists app_issue_reports_admin_all on public.app_issue_reports;
create policy app_issue_reports_admin_all on public.app_issue_reports
for all to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists app_issue_reports_settings_read on public.app_issue_reports;
create policy app_issue_reports_settings_read on public.app_issue_reports
for select to authenticated
using (public.cmms_has_permission('settings', 'manage'));

drop policy if exists app_issue_reports_active_insert on public.app_issue_reports;
create policy app_issue_reports_active_insert on public.app_issue_reports
for insert to authenticated
with check (public.cmms_current_role() in ('user', 'tech', 'worker', 'cleaner'));

drop policy if exists app_issue_reports_settings_manage on public.app_issue_reports;
create policy app_issue_reports_settings_manage on public.app_issue_reports
for all to authenticated
using (public.cmms_has_permission('settings', 'manage'))
with check (public.cmms_has_permission('settings', 'manage'));
