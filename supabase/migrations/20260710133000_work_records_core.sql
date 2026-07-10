create table if not exists public.maintenance_tasks (
  id text primary key,
  title text not null default '',
  status text not null default 'open',
  source_module text not null default '',
  meeting_id text,
  responsible_ids jsonb not null default '[]'::jsonb,
  participant_ids jsonb not null default '[]'::jsonb,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists maintenance_tasks_status_idx on public.maintenance_tasks(status);
create index if not exists maintenance_tasks_source_module_idx on public.maintenance_tasks(source_module);
create index if not exists maintenance_tasks_due_at_idx on public.maintenance_tasks(due_at);
create index if not exists maintenance_tasks_created_at_idx on public.maintenance_tasks(created_at desc);
create index if not exists maintenance_tasks_legacy_payload_gin_idx on public.maintenance_tasks using gin (legacy_payload);

create table if not exists public.maintenance_meetings (
  id text primary key,
  title text not null default '',
  status text not null default 'planned',
  agenda text not null default '',
  participant_ids jsonb not null default '[]'::jsonb,
  meeting_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists maintenance_meetings_status_idx on public.maintenance_meetings(status);
create index if not exists maintenance_meetings_meeting_at_idx on public.maintenance_meetings(meeting_at desc);
create index if not exists maintenance_meetings_legacy_payload_gin_idx on public.maintenance_meetings using gin (legacy_payload);

grant select, insert, update, delete on public.maintenance_tasks to service_role;
grant select, insert, update, delete on public.maintenance_meetings to service_role;

drop trigger if exists maintenance_tasks_touch_updated_at on public.maintenance_tasks;
create trigger maintenance_tasks_touch_updated_at
before update on public.maintenance_tasks
for each row execute function public.cmms_touch_updated_at();

drop trigger if exists maintenance_meetings_touch_updated_at on public.maintenance_meetings;
create trigger maintenance_meetings_touch_updated_at
before update on public.maintenance_meetings
for each row execute function public.cmms_touch_updated_at();

alter table public.maintenance_tasks enable row level security;
alter table public.maintenance_meetings enable row level security;

drop policy if exists maintenance_tasks_admin_all on public.maintenance_tasks;
create policy maintenance_tasks_admin_all on public.maintenance_tasks
for all to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists maintenance_tasks_active_read on public.maintenance_tasks;
create policy maintenance_tasks_active_read on public.maintenance_tasks
for select to authenticated
using (public.cmms_current_role() in ('user', 'tech', 'worker', 'cleaner'));

drop policy if exists maintenance_tasks_user_write on public.maintenance_tasks;
create policy maintenance_tasks_user_write on public.maintenance_tasks
for all to authenticated
using (public.cmms_current_role() = 'user')
with check (public.cmms_current_role() = 'user');

drop policy if exists maintenance_meetings_admin_all on public.maintenance_meetings;
create policy maintenance_meetings_admin_all on public.maintenance_meetings
for all to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists maintenance_meetings_active_read on public.maintenance_meetings;
create policy maintenance_meetings_active_read on public.maintenance_meetings
for select to authenticated
using (public.cmms_current_role() in ('user', 'tech', 'worker', 'cleaner'));

drop policy if exists maintenance_meetings_user_write on public.maintenance_meetings;
create policy maintenance_meetings_user_write on public.maintenance_meetings
for all to authenticated
using (public.cmms_current_role() = 'user')
with check (public.cmms_current_role() = 'user');
