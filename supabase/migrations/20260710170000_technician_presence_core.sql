create table if not exists public.technician_presence (
  id text primary key,
  display_name text not null default '',
  on_shift boolean not null default false,
  since_at timestamptz,
  ended_at timestamptz,
  last_seen_at timestamptz not null default now(),
  day text not null default '',
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists technician_presence_last_seen_at_idx on public.technician_presence(last_seen_at desc);
create index if not exists technician_presence_day_idx on public.technician_presence(day);
create index if not exists technician_presence_on_shift_idx on public.technician_presence(on_shift);
create index if not exists technician_presence_legacy_payload_gin_idx on public.technician_presence using gin (legacy_payload);

grant select, insert, update, delete on public.technician_presence to service_role;

drop trigger if exists technician_presence_touch_updated_at on public.technician_presence;
create trigger technician_presence_touch_updated_at
before update on public.technician_presence
for each row execute function public.cmms_touch_updated_at();

alter table public.technician_presence enable row level security;

drop policy if exists technician_presence_admin_all on public.technician_presence;
create policy technician_presence_admin_all on public.technician_presence
for all to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists technician_presence_active_read on public.technician_presence;
create policy technician_presence_active_read on public.technician_presence
for select to authenticated
using (public.cmms_current_role() in ('user', 'tech', 'worker', 'cleaner'));

drop policy if exists technician_presence_self_write on public.technician_presence;
create policy technician_presence_self_write on public.technician_presence
for all to authenticated
using (id = public.cmms_current_app_user_id()::text)
with check (id = public.cmms_current_app_user_id()::text);
