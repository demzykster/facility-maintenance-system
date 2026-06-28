grant usage on schema public to service_role;

grant select, insert, update, delete on public.app_users to service_role;
grant select, insert, update, delete on public.cmms_kv_records to service_role;
grant select, insert, update, delete on public.file_metadata to service_role;
grant select, insert, update, delete on public.audit_events to service_role;

grant execute on function public.cmms_current_app_user_id() to service_role;
grant execute on function public.cmms_current_role() to service_role;
grant execute on function public.cmms_is_admin() to service_role;
grant execute on function public.cmms_has_permission(text, text) to service_role;
