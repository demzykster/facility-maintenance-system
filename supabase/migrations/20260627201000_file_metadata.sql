create table if not exists public.file_metadata (
  id text primary key,
  owner_type text not null,
  owner_id text not null,
  owner_sub_id text not null default '',
  kind text not null,
  path text not null,
  content_type text not null default 'application/octet-stream',
  storage_provider text not null default 'supabase',
  bucket text not null default 'cmms-files',
  size_bytes integer not null default 0 check (size_bytes >= 0),
  created_by_id text,
  created_by_name text not null default '',
  created_by_role text not null default '',
  created_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists file_metadata_owner_idx on public.file_metadata(owner_type, owner_id);
create index if not exists file_metadata_path_idx on public.file_metadata(path);
create index if not exists file_metadata_kind_idx on public.file_metadata(kind);
create index if not exists file_metadata_deleted_at_idx on public.file_metadata(deleted_at);

alter table public.file_metadata enable row level security;

drop policy if exists file_metadata_audit_view on public.file_metadata;
create policy file_metadata_audit_view
on public.file_metadata
for select
to authenticated
using (public.cmms_has_permission('audit', 'view'));
