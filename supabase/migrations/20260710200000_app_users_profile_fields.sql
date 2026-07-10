alter table public.app_users
add column if not exists position text,
add column if not exists shift text,
add column if not exists shift_start text,
add column if not exists shift_end text,
add column if not exists late_tolerance integer,
add column if not exists early_tolerance integer,
add column if not exists tech_cats text[] not null default '{}',
add column if not exists cleaning_access jsonb not null default 'false'::jsonb,
add column if not exists notification_prefs jsonb not null default '{}'::jsonb,
add column if not exists employment_type text,
add column if not exists contractor_name text,
add column if not exists reports_to text,
add column if not exists status text,
add column if not exists exit_at timestamptz,
add column if not exists ppe_reset_at timestamptz;

create index if not exists app_users_tech_cats_gin_idx on public.app_users using gin (tech_cats);
create index if not exists app_users_cleaning_access_gin_idx on public.app_users using gin (cleaning_access);
create index if not exists app_users_notification_prefs_gin_idx on public.app_users using gin (notification_prefs);
