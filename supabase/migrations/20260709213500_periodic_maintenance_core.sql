create table if not exists public.periodic_maintenance (
  id text primary key,
  fleet_unit_id text not null default '',
  title text not null default '',
  frequency text not null default '',
  active boolean not null default true,
  next_due timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists periodic_maintenance_fleet_unit_idx on public.periodic_maintenance(fleet_unit_id);
create index if not exists periodic_maintenance_next_due_idx on public.periodic_maintenance(next_due);
create index if not exists periodic_maintenance_active_idx on public.periodic_maintenance(active);
create index if not exists periodic_maintenance_legacy_payload_gin_idx on public.periodic_maintenance using gin (legacy_payload);

grant select, insert, update, delete on public.periodic_maintenance to service_role;

drop trigger if exists periodic_maintenance_touch_updated_at on public.periodic_maintenance;
create trigger periodic_maintenance_touch_updated_at
before update on public.periodic_maintenance
for each row execute function public.cmms_touch_updated_at();

alter table public.periodic_maintenance enable row level security;

drop policy if exists periodic_maintenance_admin_all on public.periodic_maintenance;
create policy periodic_maintenance_admin_all
on public.periodic_maintenance
for all
to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists periodic_maintenance_user_read on public.periodic_maintenance;
create policy periodic_maintenance_user_read
on public.periodic_maintenance
for select
to authenticated
using (
  public.cmms_current_role() in ('user', 'tech')
  or public.cmms_has_permission('fleetDocs', 'view')
  or public.cmms_has_permission('fleetTickets', 'view')
);

drop policy if exists periodic_maintenance_manager_write on public.periodic_maintenance;
create policy periodic_maintenance_manager_write
on public.periodic_maintenance
for all
to authenticated
using (public.cmms_has_permission('settings', 'manage'))
with check (public.cmms_has_permission('settings', 'manage'));
