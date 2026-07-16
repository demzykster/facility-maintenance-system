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
  on conflict on constraint ticket_create_idempotency_pkey do nothing;

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

grant execute on function public.cmms_create_ticket(jsonb, text, text, text) to service_role;
