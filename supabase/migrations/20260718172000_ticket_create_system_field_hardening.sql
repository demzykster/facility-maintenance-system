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
  actor_uuid uuid;
  actor_name text := '';
  actor_role text := '';
  actor_department text := '';
  ticket_id text := nullif(trim(ticket_payload->>'id'), '');
  raw_payload jsonb := coalesce(ticket_payload->'legacy_payload', ticket_payload, '{}'::jsonb);
  safe_payload jsonb;
  namespace text;
  next_num integer;
  ticket_no text;
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

  begin
    actor_uuid := clean_actor::uuid;
  exception
    when invalid_text_representation then
      actor_uuid := null;
  end;

  if actor_uuid is not null then
    select
      coalesce(nullif(actor_profile.name, ''), ''),
      coalesce(nullif(actor_profile.role, ''), ''),
      coalesce(nullif(actor_profile.department, ''), '')
    into actor_name, actor_role, actor_department
    from public.app_users actor_profile
    where actor_profile.id = actor_uuid;
  end if;

  safe_payload := raw_payload
    - 'num'
    - 'ticketNo'
    - 'ticketNumber'
    - 'status'
    - 'createdAt'
    - 'created_at'
    - 'updatedAt'
    - 'updated_at'
    - 'closedAt'
    - 'closed_at'
    - 'sourceKvKey'
    - 'source_kv_key'
    - 'actor_id'
    - 'actorId'
    - 'createdBy'
    - 'createdById'
    - 'reportedBy'
    - 'reportedById'
    - 'reported_by_id'
    - 'reportedByName'
    - 'reported_by_name'
    - 'audit'
    - 'auditMetadata'
    - 'idempotencyResult';

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

  namespace := public.cmms_ticket_num_namespace(safe_payload->>'track', safe_payload);
  if namespace = 'T' then
    next_num := nextval('public.ticket_num_transport_seq');
  else
    next_num := nextval('public.ticket_num_facility_seq');
  end if;
  ticket_no := namespace || '-' || lpad(next_num::text, 3, '0');

  safe_payload := jsonb_set(safe_payload, '{id}', to_jsonb(ticket_id), true);
  safe_payload := jsonb_set(safe_payload, '{num}', to_jsonb(next_num), true);
  safe_payload := jsonb_set(safe_payload, '{ticketNo}', to_jsonb(ticket_no), true);
  safe_payload := jsonb_set(safe_payload, '{ticketNumber}', to_jsonb(ticket_no), true);
  safe_payload := jsonb_set(safe_payload, '{status}', '"new"', true);
  safe_payload := jsonb_set(safe_payload, '{sourceKvKey}', to_jsonb('ticket:' || ticket_id), true);
  safe_payload := jsonb_set(safe_payload, '{createdBy}', jsonb_build_object('id', clean_actor, 'name', actor_name, 'role', actor_role), true);
  safe_payload := jsonb_set(safe_payload, '{reportedBy}', jsonb_build_object('id', clean_actor, 'name', actor_name, 'role', actor_role), true);
  if actor_department <> '' then
    safe_payload := jsonb_set(safe_payload, '{department}', to_jsonb(actor_department), true);
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
    reported_by_id,
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
    coalesce(nullif(safe_payload->>'track', ''), ''),
    coalesce(safe_payload->>'subject', ''),
    coalesce(safe_payload->>'description', ''),
    'new',
    coalesce(safe_payload->>'priority', ''),
    coalesce(safe_payload->>'category', ''),
    coalesce(safe_payload->>'location', ''),
    nullif(safe_payload->>'asset_id', ''),
    coalesce(safe_payload->>'assignee_name', ''),
    actor_uuid,
    actor_name,
    coalesce(nullif(actor_department, ''), coalesce(safe_payload->>'department', '')),
    nullif(safe_payload->>'due_at', '')::timestamptz,
    now(),
    now(),
    null,
    'ticket:' || ticket_id,
    safe_payload
  )
  returning jsonb_build_object(
    'ticketId', id,
    'id', id,
    'num', num,
    'ticketNumber', ticket_no,
    'ticketNo', ticket_no,
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
