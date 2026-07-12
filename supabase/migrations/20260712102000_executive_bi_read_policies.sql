drop policy if exists tickets_executive_read on public.tickets;
create policy tickets_executive_read
on public.tickets
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists fleet_units_executive_read on public.fleet_units;
create policy fleet_units_executive_read
on public.fleet_units
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists periodic_maintenance_executive_read on public.periodic_maintenance;
create policy periodic_maintenance_executive_read
on public.periodic_maintenance
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists cleaning_zones_executive_read on public.cleaning_zones;
create policy cleaning_zones_executive_read
on public.cleaning_zones
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists cleaning_rounds_executive_read on public.cleaning_rounds;
create policy cleaning_rounds_executive_read
on public.cleaning_rounds
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists cleaning_complaints_executive_read on public.cleaning_complaints;
create policy cleaning_complaints_executive_read
on public.cleaning_complaints
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists worker_absences_executive_read on public.worker_absences;
create policy worker_absences_executive_read
on public.worker_absences
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists maintenance_tasks_executive_read on public.maintenance_tasks;
create policy maintenance_tasks_executive_read
on public.maintenance_tasks
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists maintenance_meetings_executive_read on public.maintenance_meetings;
create policy maintenance_meetings_executive_read
on public.maintenance_meetings
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists technician_presence_executive_read on public.technician_presence;
create policy technician_presence_executive_read
on public.technician_presence
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists ppe_items_executive_read on public.ppe_items;
create policy ppe_items_executive_read
on public.ppe_items
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists ppe_norms_executive_read on public.ppe_norms;
create policy ppe_norms_executive_read
on public.ppe_norms
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists ppe_movements_executive_read on public.ppe_movements;
create policy ppe_movements_executive_read
on public.ppe_movements
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists ppe_requests_executive_read on public.ppe_requests;
create policy ppe_requests_executive_read
on public.ppe_requests
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists ppe_orders_executive_read on public.ppe_orders;
create policy ppe_orders_executive_read
on public.ppe_orders
for select
to authenticated
using (public.cmms_current_role() = 'executive');

drop policy if exists app_config_executive_read on public.app_config;
create policy app_config_executive_read
on public.app_config
for select
to authenticated
using (public.cmms_current_role() = 'executive');
