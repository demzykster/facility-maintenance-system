create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  role text not null check (role in ('admin', 'user', 'tech', 'worker', 'cleaner')),
  name text not null,
  email text,
  worker_no text,
  department text,
  departments text[] not null default '{}',
  manager_zones text[] not null default '{}',
  tech_scope text check (tech_scope is null or tech_scope in ('transport', 'facility', 'both')),
  supplier text,
  active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  login_metadata jsonb not null default '{}'::jsonb,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_email_lowercase check (email is null or email = lower(email)),
  constraint app_users_worker_no_role check (
    worker_no is null
    or role in ('worker', 'cleaner')
  )
);

create index if not exists app_users_auth_user_id_idx on public.app_users(auth_user_id);
create index if not exists app_users_role_idx on public.app_users(role);
create index if not exists app_users_active_idx on public.app_users(active);
create index if not exists app_users_permissions_gin_idx on public.app_users using gin (permissions);

create or replace function public.cmms_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_users_touch_updated_at on public.app_users;
create trigger app_users_touch_updated_at
before update on public.app_users
for each row execute function public.cmms_touch_updated_at();

create or replace function public.cmms_permission_rank(level text)
returns integer
language sql
immutable
as $$
  select case coalesce(level, 'none')
    when 'none' then 0
    when 'view' then 1
    when 'request' then 2
    when 'manage' then 3
    when 'full' then 4
    else 0
  end
$$;

create or replace function public.cmms_current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.app_users
  where auth_user_id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function public.cmms_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_users
  where auth_user_id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function public.cmms_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.cmms_current_role() = 'admin', false)
$$;

create or replace function public.cmms_has_permission(module text, min_level text default 'view')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.cmms_is_admin()
    or public.cmms_permission_rank((
      select permissions ->> module
      from public.app_users
      where auth_user_id = auth.uid()
        and active = true
      limit 1
    )) >= public.cmms_permission_rank(min_level),
    false
  )
$$;

alter table public.app_users enable row level security;

drop policy if exists app_users_select_self on public.app_users;
create policy app_users_select_self
on public.app_users
for select
to authenticated
using (auth_user_id = auth.uid());

drop policy if exists app_users_select_with_users_permission on public.app_users;
create policy app_users_select_with_users_permission
on public.app_users
for select
to authenticated
using (public.cmms_has_permission('users', 'view'));

drop policy if exists app_users_admin_all on public.app_users;
create policy app_users_admin_all
on public.app_users
for all
to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

revoke all on function public.cmms_current_app_user_id() from public;
revoke all on function public.cmms_current_role() from public;
revoke all on function public.cmms_is_admin() from public;
revoke all on function public.cmms_has_permission(text, text) from public;

grant execute on function public.cmms_current_app_user_id() to authenticated;
grant execute on function public.cmms_current_role() to authenticated;
grant execute on function public.cmms_is_admin() to authenticated;
grant execute on function public.cmms_has_permission(text, text) to authenticated;
