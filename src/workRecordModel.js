const cleanString = (value) => String(value == null ? "" : value).trim();
const cleanObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const cleanArray = (value) => (Array.isArray(value) ? value : []);

const isoOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const timestamp = (value) => {
  const iso = isoOrNull(value);
  return iso ? Date.parse(iso) : undefined;
};

const legacyOrFallback = (row, fallback, normalize) => {
  const legacy = cleanObject(row.legacy_payload);
  if (legacy.id) return legacy;
  return normalize({ ...fallback, ...legacy }).legacyPayload;
};

export function normalizeMaintenanceTaskRecord(record = {}) {
  const id = cleanString(record.id);
  if (!id) throw new Error("maintenance_task_id_required");
  const now = Date.now();
  const createdAt = isoOrNull(record.createdAt || record.created_at) || new Date(now).toISOString();
  return {
    id,
    title: cleanString(record.title || record.subject),
    status: cleanString(record.status || "open"),
    sourceModule: cleanString(record.sourceModule || record.source_module || record.source || record.origin),
    meetingId: cleanString(record.meetingId || record.meeting_id) || null,
    responsibleIds: cleanArray(record.responsibleIds || record.responsible_ids),
    participantIds: cleanArray(record.participantIds || record.participant_ids),
    dueAt: isoOrNull(record.dueAt || record.due_at),
    createdAt,
    updatedAt: isoOrNull(record.updatedAt || record.updated_at || record.closedAt) || new Date(now).toISOString(),
    sourceKvKey: cleanString(record.sourceKvKey || record.source_kv_key || `mtask:${id}`),
    legacyPayload: cleanObject(record)
  };
}

export function maintenanceTaskRecordToSupabaseRow(record = {}) {
  const normalized = normalizeMaintenanceTaskRecord(record);
  return {
    id: normalized.id,
    title: normalized.title,
    status: normalized.status,
    source_module: normalized.sourceModule,
    meeting_id: normalized.meetingId,
    responsible_ids: normalized.responsibleIds,
    participant_ids: normalized.participantIds,
    due_at: normalized.dueAt,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function maintenanceTaskRecordFromSupabaseRow(row = {}) {
  return legacyOrFallback(row, {
    id: row.id,
    title: row.title,
    status: row.status,
    sourceModule: row.source_module,
    meetingId: row.meeting_id,
    responsibleIds: row.responsible_ids,
    participantIds: row.participant_ids,
    dueAt: timestamp(row.due_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    sourceKvKey: row.source_kv_key
  }, normalizeMaintenanceTaskRecord);
}

export function normalizeMaintenanceMeetingRecord(record = {}) {
  const id = cleanString(record.id);
  if (!id) throw new Error("maintenance_meeting_id_required");
  const now = Date.now();
  const meetingAt = isoOrNull(record.meetingAt || record.meeting_at || record.at || record.createdAt) || new Date(now).toISOString();
  return {
    id,
    title: cleanString(record.title || record.subject),
    status: cleanString(record.status || "planned"),
    agenda: cleanString(record.agenda),
    participantIds: cleanArray(record.participantIds || record.participant_ids),
    meetingAt,
    createdAt: isoOrNull(record.createdAt || record.created_at || record.at) || meetingAt,
    updatedAt: isoOrNull(record.updatedAt || record.updated_at || record.at) || new Date(now).toISOString(),
    sourceKvKey: cleanString(record.sourceKvKey || record.source_kv_key || `mmeet:${id}`),
    legacyPayload: cleanObject(record)
  };
}

export function maintenanceMeetingRecordToSupabaseRow(record = {}) {
  const normalized = normalizeMaintenanceMeetingRecord(record);
  return {
    id: normalized.id,
    title: normalized.title,
    status: normalized.status,
    agenda: normalized.agenda,
    participant_ids: normalized.participantIds,
    meeting_at: normalized.meetingAt,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function maintenanceMeetingRecordFromSupabaseRow(row = {}) {
  return legacyOrFallback(row, {
    id: row.id,
    title: row.title,
    status: row.status,
    agenda: row.agenda,
    participantIds: row.participant_ids,
    at: timestamp(row.meeting_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    sourceKvKey: row.source_kv_key
  }, normalizeMaintenanceMeetingRecord);
}
