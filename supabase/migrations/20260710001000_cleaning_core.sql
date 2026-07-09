create table if not exists public.cleaning_zones (
  id text primary key,
  name text not null default '',
  building text not null default '',
  floor text not null default '',
  area_name text not null default '',
  cleaner_id uuid references public.app_users(id) on delete set null,
  cleaner_name text not null default '',
  active boolean not null default true,
  checklist jsonb not null default '[]'::jsonb,
  windows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists cleaning_zones_active_idx on public.cleaning_zones(active);
create index if not exists cleaning_zones_cleaner_id_idx on public.cleaning_zones(cleaner_id);
create index if not exists cleaning_zones_area_name_idx on public.cleaning_zones(area_name);
create index if not exists cleaning_zones_legacy_payload_gin_idx on public.cleaning_zones using gin (legacy_payload);

create table if not exists public.cleaning_rounds (
  id text primary key,
  zone_id text references public.cleaning_zones(id) on delete set null,
  cleaner_id uuid references public.app_users(id) on delete set null,
  cleaner_name text not null default '',
  status text not null default '',
  round_at timestamptz,
  completed_at timestamptz,
  manual_reason text not null default '',
  issues jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists cleaning_rounds_zone_id_idx on public.cleaning_rounds(zone_id);
create index if not exists cleaning_rounds_cleaner_id_idx on public.cleaning_rounds(cleaner_id);
create index if not exists cleaning_rounds_status_idx on public.cleaning_rounds(status);
create index if not exists cleaning_rounds_round_at_idx on public.cleaning_rounds(round_at desc);
create index if not exists cleaning_rounds_legacy_payload_gin_idx on public.cleaning_rounds using gin (legacy_payload);

create table if not exists public.cleaning_complaints (
  id text primary key,
  zone_id text references public.cleaning_zones(id) on delete set null,
  zone_name text not null default '',
  status text not null default 'pending',
  kind text not null default '',
  text text not null default '',
  owner_role text not null default '',
  reported_by_id uuid references public.app_users(id) on delete set null,
  reported_by_name text not null default '',
  resolved_by_id uuid references public.app_users(id) on delete set null,
  resolved_by_name text not null default '',
  ticket_id text references public.tickets(id) on delete set null,
  photo_path text,
  has_photo boolean not null default false,
  verified boolean not null default false,
  complaint_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists cleaning_complaints_zone_id_idx on public.cleaning_complaints(zone_id);
create index if not exists cleaning_complaints_status_idx on public.cleaning_complaints(status);
create index if not exists cleaning_complaints_kind_idx on public.cleaning_complaints(kind);
create index if not exists cleaning_complaints_complaint_at_idx on public.cleaning_complaints(complaint_at desc);
create index if not exists cleaning_complaints_ticket_id_idx on public.cleaning_complaints(ticket_id);
create index if not exists cleaning_complaints_legacy_payload_gin_idx on public.cleaning_complaints using gin (legacy_payload);

create table if not exists public.worker_absences (
  id text primary key,
  user_id uuid references public.app_users(id) on delete set null,
  user_name text not null default '',
  starts_on date not null,
  ends_on date not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists worker_absences_user_id_idx on public.worker_absences(user_id);
create index if not exists worker_absences_starts_on_idx on public.worker_absences(starts_on);
create index if not exists worker_absences_legacy_payload_gin_idx on public.worker_absences using gin (legacy_payload);

grant select, insert, update, delete on public.cleaning_zones to service_role;
grant select, insert, update, delete on public.cleaning_rounds to service_role;
grant select, insert, update, delete on public.cleaning_complaints to service_role;
grant select, insert, update, delete on public.worker_absences to service_role;

drop trigger if exists cleaning_zones_touch_updated_at on public.cleaning_zones;
create trigger cleaning_zones_touch_updated_at
before update on public.cleaning_zones
for each row execute function public.cmms_touch_updated_at();

drop trigger if exists cleaning_rounds_touch_updated_at on public.cleaning_rounds;
create trigger cleaning_rounds_touch_updated_at
before update on public.cleaning_rounds
for each row execute function public.cmms_touch_updated_at();

drop trigger if exists cleaning_complaints_touch_updated_at on public.cleaning_complaints;
create trigger cleaning_complaints_touch_updated_at
before update on public.cleaning_complaints
for each row execute function public.cmms_touch_updated_at();

drop trigger if exists worker_absences_touch_updated_at on public.worker_absences;
create trigger worker_absences_touch_updated_at
before update on public.worker_absences
for each row execute function public.cmms_touch_updated_at();

alter table public.cleaning_zones enable row level security;
alter table public.cleaning_rounds enable row level security;
alter table public.cleaning_complaints enable row level security;
alter table public.worker_absences enable row level security;

drop policy if exists cleaning_zones_admin_all on public.cleaning_zones;
create policy cleaning_zones_admin_all
on public.cleaning_zones
for all
to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists cleaning_zones_cleaning_read on public.cleaning_zones;
create policy cleaning_zones_cleaning_read
on public.cleaning_zones
for select
to authenticated
using (
  public.cmms_current_role() in ('user', 'cleaner')
  or public.cmms_has_permission('cleaning', 'view')
  or public.cmms_has_permission('settings', 'manage')
);

drop policy if exists cleaning_zones_manager_write on public.cleaning_zones;
create policy cleaning_zones_manager_write
on public.cleaning_zones
for all
to authenticated
using (
  public.cmms_has_permission('cleaning', 'manage')
  or public.cmms_has_permission('settings', 'manage')
)
with check (
  public.cmms_has_permission('cleaning', 'manage')
  or public.cmms_has_permission('settings', 'manage')
);

drop policy if exists cleaning_rounds_admin_all on public.cleaning_rounds;
create policy cleaning_rounds_admin_all
on public.cleaning_rounds
for all
to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists cleaning_rounds_cleaning_read on public.cleaning_rounds;
create policy cleaning_rounds_cleaning_read
on public.cleaning_rounds
for select
to authenticated
using (
  public.cmms_current_role() in ('user', 'cleaner')
  or cleaner_id = public.cmms_current_app_user_id()
  or public.cmms_has_permission('cleaning', 'view')
  or public.cmms_has_permission('analytics', 'view')
);

drop policy if exists cleaning_rounds_cleaning_write on public.cleaning_rounds;
create policy cleaning_rounds_cleaning_write
on public.cleaning_rounds
for all
to authenticated
using (
  public.cmms_current_role() in ('user', 'cleaner')
  or cleaner_id = public.cmms_current_app_user_id()
  or public.cmms_has_permission('cleaning', 'manage')
)
with check (
  public.cmms_current_role() in ('user', 'cleaner')
  or cleaner_id = public.cmms_current_app_user_id()
  or public.cmms_has_permission('cleaning', 'manage')
);

drop policy if exists cleaning_complaints_admin_all on public.cleaning_complaints;
create policy cleaning_complaints_admin_all
on public.cleaning_complaints
for all
to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists cleaning_complaints_cleaning_read on public.cleaning_complaints;
create policy cleaning_complaints_cleaning_read
on public.cleaning_complaints
for select
to authenticated
using (
  public.cmms_current_role() in ('user', 'cleaner')
  or reported_by_id = public.cmms_current_app_user_id()
  or resolved_by_id = public.cmms_current_app_user_id()
  or public.cmms_has_permission('cleaning', 'view')
  or public.cmms_has_permission('analytics', 'view')
);

drop policy if exists cleaning_complaints_cleaning_write on public.cleaning_complaints;
create policy cleaning_complaints_cleaning_write
on public.cleaning_complaints
for all
to authenticated
using (
  public.cmms_current_role() in ('user', 'cleaner')
  or reported_by_id = public.cmms_current_app_user_id()
  or public.cmms_has_permission('cleaning', 'manage')
)
with check (
  public.cmms_current_role() in ('user', 'cleaner')
  or reported_by_id = public.cmms_current_app_user_id()
  or public.cmms_has_permission('cleaning', 'manage')
);

drop policy if exists worker_absences_admin_all on public.worker_absences;
create policy worker_absences_admin_all
on public.worker_absences
for all
to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists worker_absences_self_read on public.worker_absences;
create policy worker_absences_self_read
on public.worker_absences
for select
to authenticated
using (
  user_id = public.cmms_current_app_user_id()
  or public.cmms_has_permission('cleaning', 'view')
  or public.cmms_has_permission('settings', 'manage')
);

drop policy if exists worker_absences_self_write on public.worker_absences;
create policy worker_absences_self_write
on public.worker_absences
for all
to authenticated
using (
  user_id = public.cmms_current_app_user_id()
  or public.cmms_has_permission('cleaning', 'manage')
  or public.cmms_has_permission('settings', 'manage')
)
with check (
  user_id = public.cmms_current_app_user_id()
  or public.cmms_has_permission('cleaning', 'manage')
  or public.cmms_has_permission('settings', 'manage')
);
