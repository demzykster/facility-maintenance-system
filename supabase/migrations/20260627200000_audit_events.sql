create table if not exists public.audit_events (
  id text primary key,
  at timestamptz not null,
  actor_id text,
  actor_name text not null default '',
  actor_role text not null default '',
  entity_type text not null,
  entity_id text not null default '',
  action text not null,
  summary text not null default '',
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_at_idx on public.audit_events(at desc);
create index if not exists audit_events_actor_id_idx on public.audit_events(actor_id);
create index if not exists audit_events_entity_idx on public.audit_events(entity_type, entity_id);
create index if not exists audit_events_action_idx on public.audit_events(action);

alter table public.audit_events enable row level security;

drop policy if exists audit_events_view on public.audit_events;
create policy audit_events_view
on public.audit_events
for select
to authenticated
using (public.cmms_has_permission('audit', 'view'));
