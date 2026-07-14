create or replace function public.cmms_ticket_num_namespace(ticket_track text, ticket_payload jsonb default '{}'::jsonb)
returns text
language sql
immutable
as $$
  select case
    when coalesce(nullif(ticket_track, ''), ticket_payload->>'track') = 'transport'
      or nullif(ticket_payload->>'forkliftId', '') is not null
      or nullif(ticket_payload->>'forklift_id', '') is not null
    then 'T'
    else 'F'
  end;
$$;

do $$
begin
  if exists (
    select 1
    from public.tickets
    where num is null
  ) then
    raise exception 'ticket_number_null_preflight_failed';
  end if;

  if exists (
    select 1
    from (
      select
        public.cmms_ticket_num_namespace(track, legacy_payload) as namespace,
        num,
        count(*) as n
      from public.tickets
      where num is not null
      group by public.cmms_ticket_num_namespace(track, legacy_payload), num
    ) dupes
    where dupes.n > 1
  ) then
    raise exception 'ticket_number_duplicate_preflight_failed';
  end if;

  if exists (
    select 1
    from public.tickets
    where lower(coalesce(track, '')) in ('forklift', 'fleet', 'vehicle', 'machine', 'transportation')
  ) then
    raise exception 'ticket_track_alias_preflight_failed';
  end if;

  if exists (
    select 1
    from public.tickets
    where coalesce(track, '') not in ('', 'facility', 'transport')
  ) then
    raise exception 'ticket_track_preflight_failed';
  end if;

  if exists (
    select 1
    from public.tickets
    where public.cmms_ticket_num_namespace(track, legacy_payload) = 'T'
      and coalesce(track, '') not in ('', 'transport')
  ) then
    raise exception 'ticket_transport_track_preflight_failed';
  end if;

  if exists (
    select 1
    from public.tickets
    where legacy_payload ? 'track'
      and coalesce(track, '') <> coalesce(legacy_payload->>'track', '')
  ) then
    raise exception 'ticket_track_payload_mismatch_preflight_failed';
  end if;

  if exists (
    select 1
    from public.tickets
    where legacy_payload ? 'num'
      and num::text <> legacy_payload->>'num'
  ) then
    raise exception 'ticket_num_payload_mismatch_preflight_failed';
  end if;
end $$;

create sequence if not exists public.ticket_num_facility_seq;
create sequence if not exists public.ticket_num_transport_seq;

do $$
declare
  facility_max integer;
  transport_max integer;
begin
  select max(num) into facility_max
  from public.tickets
  where public.cmms_ticket_num_namespace(track, legacy_payload) = 'F';

  select max(num) into transport_max
  from public.tickets
  where public.cmms_ticket_num_namespace(track, legacy_payload) = 'T';

  if facility_max is null then
    perform setval('public.ticket_num_facility_seq', 1, false);
  else
    perform setval('public.ticket_num_facility_seq', facility_max, true);
  end if;

  if transport_max is null then
    perform setval('public.ticket_num_transport_seq', 1, false);
  else
    perform setval('public.ticket_num_transport_seq', transport_max, true);
  end if;
end $$;

create unique index if not exists tickets_namespace_num_uidx
on public.tickets (public.cmms_ticket_num_namespace(track, legacy_payload), num)
where num is not null;

create table if not exists public.ticket_create_idempotency (
  operation text not null default 'create_ticket',
  actor_id text not null,
  idempotency_key text not null,
  request_hash text not null,
  ticket_id text references public.tickets(id) on delete set null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (operation, actor_id, idempotency_key)
);

create index if not exists ticket_create_idempotency_created_at_idx
on public.ticket_create_idempotency(created_at);

grant select, insert, update, delete on public.ticket_create_idempotency to service_role;
grant usage, select on sequence public.ticket_num_facility_seq to service_role;
grant usage, select on sequence public.ticket_num_transport_seq to service_role;

create or replace function public.cmms_create_ticket(
  ticket_payload jsonb,
  idempotency_key text,
  request_hash text,
  actor_id text
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  clean_key text := nullif(trim(idempotency_key), '');
  clean_hash text := nullif(trim(request_hash), '');
  clean_actor text := nullif(trim(actor_id), '');
  ticket_id text := nullif(trim(ticket_payload->>'id'), '');
  namespace text;
  next_num integer;
  row_result jsonb;
  existing public.ticket_create_idempotency%rowtype;
begin
  if clean_key is null then
    raise exception 'idempotency_key_required';
  end if;
  if clean_hash is null then
    raise exception 'request_hash_required';
  end if;
  if clean_actor is null then
    raise exception 'actor_id_required';
  end if;
  if ticket_id is null then
    raise exception 'ticket_id_required';
  end if;

  insert into public.ticket_create_idempotency(operation, actor_id, idempotency_key, request_hash)
  values ('create_ticket', clean_actor, clean_key, clean_hash)
  on conflict (operation, actor_id, idempotency_key) do nothing;

  select * into existing
  from public.ticket_create_idempotency idem
  where idem.operation = 'create_ticket'
    and idem.actor_id = clean_actor
    and idem.idempotency_key = clean_key
  for update;

  if not found then
    raise exception 'idempotency_reservation_failed';
  end if;
  if existing.request_hash <> clean_hash then
    raise exception 'idempotency_conflict';
  end if;
  if existing.ticket_id is not null and existing.result <> '{}'::jsonb then
    return jsonb_set(existing.result, '{idempotencyStatus}', '"replayed"', true);
  end if;

  namespace := public.cmms_ticket_num_namespace(ticket_payload->>'track', coalesce(ticket_payload->'legacy_payload', ticket_payload));
  if namespace = 'T' then
    next_num := nextval('public.ticket_num_transport_seq');
  else
    next_num := nextval('public.ticket_num_facility_seq');
  end if;

  insert into public.tickets (
    id,
    num,
    track,
    subject,
    description,
    status,
    priority,
    category,
    location,
    asset_id,
    assignee_name,
    reported_by_name,
    department,
    due_at,
    created_at,
    updated_at,
    closed_at,
    source_kv_key,
    legacy_payload
  )
  values (
    ticket_id,
    next_num,
    coalesce(nullif(ticket_payload->>'track', ''), ''),
    coalesce(ticket_payload->>'subject', ''),
    coalesce(ticket_payload->>'description', ''),
    coalesce(nullif(ticket_payload->>'status', ''), 'new'),
    coalesce(ticket_payload->>'priority', ''),
    coalesce(ticket_payload->>'category', ''),
    coalesce(ticket_payload->>'location', ''),
    nullif(ticket_payload->>'asset_id', ''),
    coalesce(ticket_payload->>'assignee_name', ''),
    coalesce(ticket_payload->>'reported_by_name', ''),
    coalesce(ticket_payload->>'department', ''),
    nullif(ticket_payload->>'due_at', '')::timestamptz,
    coalesce(nullif(ticket_payload->>'created_at', '')::timestamptz, now()),
    coalesce(nullif(ticket_payload->>'updated_at', '')::timestamptz, now()),
    nullif(ticket_payload->>'closed_at', '')::timestamptz,
    coalesce(nullif(ticket_payload->>'source_kv_key', ''), 'ticket:' || ticket_id),
    jsonb_set(coalesce(ticket_payload->'legacy_payload', ticket_payload), '{num}', to_jsonb(next_num), true)
  )
  returning jsonb_build_object(
    'ticketId', id,
    'id', id,
    'num', num,
    'ticketNumber', namespace || '-' || lpad(num::text, 3, '0'),
    'ticketNo', namespace || '-' || lpad(num::text, 3, '0'),
    'track', track,
    'status', status,
    'idempotencyStatus', 'created'
  ) into row_result;

  update public.ticket_create_idempotency
  set ticket_id = row_result->>'ticketId',
      result = row_result
  where public.ticket_create_idempotency.operation = 'create_ticket'
    and public.ticket_create_idempotency.actor_id = clean_actor
    and public.ticket_create_idempotency.idempotency_key = clean_key;

  return row_result;
end;
$$;

revoke all on function public.cmms_create_ticket(jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.cmms_create_ticket(jsonb, text, text, text) to service_role;

create or replace function public.cmms_cleanup_ticket_create_idempotency(retention interval default interval '30 days')
returns integer
language plpgsql
security invoker
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.ticket_create_idempotency
  where ticket_id is not null
    and result <> '{}'::jsonb
    and created_at < now() - retention;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cmms_cleanup_ticket_create_idempotency(interval) from public, anon, authenticated;
grant execute on function public.cmms_cleanup_ticket_create_idempotency(interval) to service_role;
