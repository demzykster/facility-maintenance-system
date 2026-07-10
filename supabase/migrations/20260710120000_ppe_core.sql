create table if not exists public.ppe_items (
  id text primary key,
  name text not null default '',
  category text not null default '',
  sku text not null default '',
  active boolean not null default true,
  sizes jsonb not null default '[]'::jsonb,
  stock_by_size jsonb not null default '{}'::jsonb,
  min_by_size jsonb not null default '{}'::jsonb,
  min_stock numeric not null default 0,
  unit_cost numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists ppe_items_active_idx on public.ppe_items(active);
create index if not exists ppe_items_category_idx on public.ppe_items(category);
create index if not exists ppe_items_name_idx on public.ppe_items(name);
create index if not exists ppe_items_legacy_payload_gin_idx on public.ppe_items using gin (legacy_payload);

create table if not exists public.ppe_norms (
  id text primary key,
  dept text not null default '',
  item_id text references public.ppe_items(id) on delete set null,
  active boolean not null default true,
  policy text not null default '',
  worker_pct numeric not null default 0,
  period_months numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists ppe_norms_dept_idx on public.ppe_norms(dept);
create index if not exists ppe_norms_item_id_idx on public.ppe_norms(item_id);
create index if not exists ppe_norms_active_idx on public.ppe_norms(active);
create index if not exists ppe_norms_legacy_payload_gin_idx on public.ppe_norms using gin (legacy_payload);

create table if not exists public.ppe_movements (
  id text primary key,
  worker_id uuid references public.app_users(id) on delete set null,
  worker_name text not null default '',
  item_id text references public.ppe_items(id) on delete set null,
  item_name text not null default '',
  size text not null default '',
  qty numeric not null default 0,
  movement_type text not null default '',
  movement_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists ppe_movements_worker_id_idx on public.ppe_movements(worker_id);
create index if not exists ppe_movements_item_id_idx on public.ppe_movements(item_id);
create index if not exists ppe_movements_movement_at_idx on public.ppe_movements(movement_at desc);
create index if not exists ppe_movements_legacy_payload_gin_idx on public.ppe_movements using gin (legacy_payload);

create table if not exists public.ppe_requests (
  id text primary key,
  worker_id uuid references public.app_users(id) on delete set null,
  worker_name text not null default '',
  status text not null default 'pending',
  lines jsonb not null default '[]'::jsonb,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists ppe_requests_worker_id_idx on public.ppe_requests(worker_id);
create index if not exists ppe_requests_status_idx on public.ppe_requests(status);
create index if not exists ppe_requests_requested_at_idx on public.ppe_requests(requested_at desc);
create index if not exists ppe_requests_legacy_payload_gin_idx on public.ppe_requests using gin (legacy_payload);

create table if not exists public.ppe_orders (
  id text primary key,
  supplier text not null default '',
  status text not null default 'draft',
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  received_at timestamptz,
  updated_at timestamptz not null default now(),
  source_kv_key text unique,
  legacy_payload jsonb not null default '{}'::jsonb
);

create index if not exists ppe_orders_supplier_idx on public.ppe_orders(supplier);
create index if not exists ppe_orders_status_idx on public.ppe_orders(status);
create index if not exists ppe_orders_created_at_idx on public.ppe_orders(created_at desc);
create index if not exists ppe_orders_legacy_payload_gin_idx on public.ppe_orders using gin (legacy_payload);

grant select, insert, update, delete on public.ppe_items to service_role;
grant select, insert, update, delete on public.ppe_norms to service_role;
grant select, insert, update, delete on public.ppe_movements to service_role;
grant select, insert, update, delete on public.ppe_requests to service_role;
grant select, insert, update, delete on public.ppe_orders to service_role;

drop trigger if exists ppe_items_touch_updated_at on public.ppe_items;
create trigger ppe_items_touch_updated_at
before update on public.ppe_items
for each row execute function public.cmms_touch_updated_at();

drop trigger if exists ppe_norms_touch_updated_at on public.ppe_norms;
create trigger ppe_norms_touch_updated_at
before update on public.ppe_norms
for each row execute function public.cmms_touch_updated_at();

drop trigger if exists ppe_movements_touch_updated_at on public.ppe_movements;
create trigger ppe_movements_touch_updated_at
before update on public.ppe_movements
for each row execute function public.cmms_touch_updated_at();

drop trigger if exists ppe_requests_touch_updated_at on public.ppe_requests;
create trigger ppe_requests_touch_updated_at
before update on public.ppe_requests
for each row execute function public.cmms_touch_updated_at();

drop trigger if exists ppe_orders_touch_updated_at on public.ppe_orders;
create trigger ppe_orders_touch_updated_at
before update on public.ppe_orders
for each row execute function public.cmms_touch_updated_at();

alter table public.ppe_items enable row level security;
alter table public.ppe_norms enable row level security;
alter table public.ppe_movements enable row level security;
alter table public.ppe_requests enable row level security;
alter table public.ppe_orders enable row level security;

drop policy if exists ppe_items_admin_all on public.ppe_items;
create policy ppe_items_admin_all on public.ppe_items
for all to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists ppe_items_read on public.ppe_items;
create policy ppe_items_read on public.ppe_items
for select to authenticated
using (
  public.cmms_has_permission('ppe', 'request')
  or public.cmms_has_permission('ppe', 'view')
);

drop policy if exists ppe_items_manage on public.ppe_items;
create policy ppe_items_manage on public.ppe_items
for all to authenticated
using (public.cmms_has_permission('ppe', 'manage'))
with check (public.cmms_has_permission('ppe', 'manage'));

drop policy if exists ppe_norms_admin_all on public.ppe_norms;
create policy ppe_norms_admin_all on public.ppe_norms
for all to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists ppe_norms_read on public.ppe_norms;
create policy ppe_norms_read on public.ppe_norms
for select to authenticated
using (
  public.cmms_has_permission('ppe', 'request')
  or public.cmms_has_permission('ppe', 'view')
);

drop policy if exists ppe_norms_manage on public.ppe_norms;
create policy ppe_norms_manage on public.ppe_norms
for all to authenticated
using (public.cmms_has_permission('ppe', 'manage'))
with check (public.cmms_has_permission('ppe', 'manage'));

drop policy if exists ppe_movements_admin_all on public.ppe_movements;
create policy ppe_movements_admin_all on public.ppe_movements
for all to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists ppe_movements_read on public.ppe_movements;
create policy ppe_movements_read on public.ppe_movements
for select to authenticated
using (
  worker_id = public.cmms_current_app_user_id()
  or public.cmms_has_permission('ppe', 'view')
  or public.cmms_has_permission('ppe', 'manage')
);

drop policy if exists ppe_movements_manage on public.ppe_movements;
create policy ppe_movements_manage on public.ppe_movements
for all to authenticated
using (public.cmms_has_permission('ppe', 'manage'))
with check (public.cmms_has_permission('ppe', 'manage'));

drop policy if exists ppe_requests_admin_all on public.ppe_requests;
create policy ppe_requests_admin_all on public.ppe_requests
for all to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists ppe_requests_read on public.ppe_requests;
create policy ppe_requests_read on public.ppe_requests
for select to authenticated
using (
  worker_id = public.cmms_current_app_user_id()
  or public.cmms_has_permission('ppe', 'request')
  or public.cmms_has_permission('ppe', 'manage')
);

drop policy if exists ppe_requests_request_write on public.ppe_requests;
create policy ppe_requests_request_write on public.ppe_requests
for insert to authenticated
with check (
  worker_id = public.cmms_current_app_user_id()
  or public.cmms_has_permission('ppe', 'request')
);

drop policy if exists ppe_requests_manage on public.ppe_requests;
create policy ppe_requests_manage on public.ppe_requests
for all to authenticated
using (public.cmms_has_permission('ppe', 'manage'))
with check (public.cmms_has_permission('ppe', 'manage'));

drop policy if exists ppe_orders_admin_all on public.ppe_orders;
create policy ppe_orders_admin_all on public.ppe_orders
for all to authenticated
using (public.cmms_is_admin())
with check (public.cmms_is_admin());

drop policy if exists ppe_orders_read on public.ppe_orders;
create policy ppe_orders_read on public.ppe_orders
for select to authenticated
using (public.cmms_has_permission('ppe', 'manage'));

drop policy if exists ppe_orders_manage on public.ppe_orders;
create policy ppe_orders_manage on public.ppe_orders
for all to authenticated
using (public.cmms_has_permission('ppe', 'manage'))
with check (public.cmms_has_permission('ppe', 'manage'));
