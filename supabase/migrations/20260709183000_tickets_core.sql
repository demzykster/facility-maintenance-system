create table if not exists public.tickets (
  id text primary key,
  num integer,
  track text not null default '',
  subject text not null default '',
  description text not null default '',
  status text not null default 'new',
  priority text not null default '',
  category text not null default '',
  location text not null default '',
  asset_id text,
  assignee_id uuid references public.app_users(id) on delete set null,
  assignee_name text not null default '',
  reported_by_id uuid references public.app_users(id) on delete set null,
  reported_by_name text not null default '',
  department text not null default '',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists tickets_status_idx on public.tickets(status);
create index if not exists tickets_track_idx on public.tickets(track);
create index if not exists tickets_assignee_id_idx on public.tickets(assignee_id);
create index if not exists tickets_reported_by_id_idx on public.tickets(reported_by_id);
create index if not exists tickets_created_at_idx on public.tickets(created_at desc);
create index if not exists tickets_updated_at_idx on public.tickets(updated_at desc);
create index if not exists tickets_legacy_payload_gin_idx on public.tickets using gin (legacy_payload);

grant select, insert, update, delete on public.tickets to service_role;

drop trigger if exists tickets_touch_updated_at on public.tickets;
create trigger tickets_touch_updated_at
before update on public.tickets
for each row execute function public.cmms_touch_updated_at();

alter table public.tickets enable row level security;

drop policy if exists tickets_admin_all on public.tickets;
create policy tickets_admin_all
on public.tickets
for all
to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists tickets_manager_read on public.tickets;
create policy tickets_manager_read
on public.tickets
for select
to authenticated
using (public.cmms_has_permission('tickets', 'view'));

drop policy if exists tickets_manager_write on public.tickets;
create policy tickets_manager_write
on public.tickets
for all
to authenticated
using (public.cmms_has_permission('tickets', 'manage'))
with check (public.cmms_has_permission('tickets', 'manage'));

drop policy if exists tickets_assignee_read on public.tickets;
create policy tickets_assignee_read
on public.tickets
for select
to authenticated
using (assignee_id = public.cmms_current_app_user_id());

drop policy if exists tickets_reporter_read on public.tickets;
create policy tickets_reporter_read
on public.tickets
for select
to authenticated
using (reported_by_id = public.cmms_current_app_user_id());
