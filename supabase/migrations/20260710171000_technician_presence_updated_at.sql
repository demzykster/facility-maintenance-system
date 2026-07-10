alter table public.technician_presence
add column if not exists updated_at timestamptz not null default now();

drop trigger if exists technician_presence_touch_updated_at on public.technician_presence;
create trigger technician_presence_touch_updated_at
before update on public.technician_presence
for each row execute function public.cmms_touch_updated_at();
