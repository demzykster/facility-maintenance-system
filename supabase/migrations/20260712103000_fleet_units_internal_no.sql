alter table public.fleet_units
add column if not exists internal_no text not null default '';

create index if not exists fleet_units_internal_no_idx on public.fleet_units(internal_no);
