alter table public.app_users
add column if not exists pin_hash text,
add column if not exists pin_updated_at timestamptz,
add column if not exists login_state text not null default 'pending_setup';

alter table public.app_users
drop constraint if exists app_users_login_state_check;

alter table public.app_users
add constraint app_users_login_state_check
check (login_state in ('pending_setup', 'active', 'reset_required', 'disabled'));

update public.app_users
set login_state = case
  when active = false then 'disabled'
  when auth_user_id is not null then 'active'
  else login_state
end
where login_state = 'pending_setup';

create index if not exists app_users_worker_no_idx on public.app_users(worker_no);
create index if not exists app_users_phone_idx on public.app_users(phone);
create index if not exists app_users_login_state_idx on public.app_users(login_state);
