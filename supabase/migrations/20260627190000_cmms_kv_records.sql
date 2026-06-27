create table if not exists public.cmms_kv_records (
  scope text not null check (scope in ('shared', 'local')),
  record_key text not null,
  value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, record_key)
);

create index if not exists cmms_kv_records_scope_key_idx
on public.cmms_kv_records(scope, record_key text_pattern_ops);

drop trigger if exists cmms_kv_records_touch_updated_at on public.cmms_kv_records;
create trigger cmms_kv_records_touch_updated_at
before update on public.cmms_kv_records
for each row execute function public.cmms_touch_updated_at();

alter table public.cmms_kv_records enable row level security;

drop policy if exists cmms_kv_records_admin_read on public.cmms_kv_records;
create policy cmms_kv_records_admin_read
on public.cmms_kv_records
for select
to authenticated
using (public.cmms_is_admin());

drop policy if exists cmms_kv_records_admin_write on public.cmms_kv_records;
create policy cmms_kv_records_admin_write
on public.cmms_kv_records
for all
to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());
