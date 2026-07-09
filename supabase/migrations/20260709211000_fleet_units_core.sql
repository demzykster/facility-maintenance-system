create table if not exists public.fleet_units (
  id text primary key,
  code text not null default '',
  vehicle_type text not null default '',
  model text not null default '',
  supplier text not null default '',
  department text not null default '',
  location text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists fleet_units_code_idx on public.fleet_units(code);
create index if not exists fleet_units_vehicle_type_idx on public.fleet_units(vehicle_type);
create index if not exists fleet_units_model_idx on public.fleet_units(model);
create index if not exists fleet_units_supplier_idx on public.fleet_units(supplier);
create index if not exists fleet_units_status_idx on public.fleet_units(status);
create index if not exists fleet_units_legacy_payload_gin_idx on public.fleet_units using gin (legacy_payload);

grant select, insert, update, delete on public.fleet_units to service_role;

drop trigger if exists fleet_units_touch_updated_at on public.fleet_units;
create trigger fleet_units_touch_updated_at
before update on public.fleet_units
for each row execute function public.cmms_touch_updated_at();

alter table public.fleet_units enable row level security;

drop policy if exists fleet_units_admin_all on public.fleet_units;
create policy fleet_units_admin_all
on public.fleet_units
for all
to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists fleet_units_user_read on public.fleet_units;
create policy fleet_units_user_read
on public.fleet_units
for select
to authenticated
using (
  public.cmms_current_role() in ('user', 'tech')
  or public.cmms_has_permission('fleetDocs', 'view')
  or public.cmms_has_permission('fleetTickets', 'view')
);

drop policy if exists fleet_units_manager_write on public.fleet_units;
create policy fleet_units_manager_write
on public.fleet_units
for all
to authenticated
using (public.cmms_has_permission('settings', 'manage'))
with check (public.cmms_has_permission('settings', 'manage'));
