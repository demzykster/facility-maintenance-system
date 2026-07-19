begin;

create table if not exists public.ai_memory_facts (
  id text primary key,
  scope_type text not null,
  scope_id text not null,
  fact_type text not null default 'note',
  summary text not null,
  details text not null default '',
  source_type text not null default 'ai_chat',
  source_id text not null default '',
  source_label text not null default '',
  confidence text not null default 'confirmed',
  status text not null default 'active',
  version integer not null default 1,
  supersedes_id text references public.ai_memory_facts(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint ai_memory_facts_scope_type_check check (scope_type in ('personal', 'department', 'organization', 'asset')),
  constraint ai_memory_facts_confidence_check check (confidence in ('confirmed', 'inferred', 'needs_review')),
  constraint ai_memory_facts_status_check check (status in ('active', 'superseded', 'deactivated')),
  constraint ai_memory_facts_version_check check (version >= 1),
  constraint ai_memory_facts_summary_check check (length(btrim(summary)) > 0),
  constraint ai_memory_facts_scope_check check (length(btrim(scope_id)) > 0)
);

create index if not exists ai_memory_facts_scope_idx
  on public.ai_memory_facts (scope_type, scope_id, status, updated_at desc);

create index if not exists ai_memory_facts_scope_fact_idx
  on public.ai_memory_facts (scope_type, scope_id, fact_type, status, updated_at desc);

create index if not exists ai_memory_facts_created_by_idx
  on public.ai_memory_facts (created_by, status, updated_at desc);

create index if not exists ai_memory_facts_supersedes_idx
  on public.ai_memory_facts (supersedes_id)
  where supersedes_id is not null;

create index if not exists ai_memory_facts_active_idx
  on public.ai_memory_facts (updated_at desc)
  where status = 'active';

create or replace function public.set_ai_memory_facts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ai_memory_facts_updated_at on public.ai_memory_facts;
create trigger set_ai_memory_facts_updated_at
before update on public.ai_memory_facts
for each row execute function public.set_ai_memory_facts_updated_at();

alter table public.ai_memory_facts enable row level security;

revoke all on table public.ai_memory_facts from public;
revoke all on table public.ai_memory_facts from anon;
revoke all on table public.ai_memory_facts from authenticated;
grant select, insert, update, delete on table public.ai_memory_facts to service_role;

commit;
