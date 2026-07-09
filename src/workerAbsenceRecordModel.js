const cleanString = (value) => String(value == null ? "" : value).trim();
const cleanObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const uuidOrNull = (value) => {
  const text = cleanString(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(text) ? text : null;
};

const isoOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const dateOnlyOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const text = cleanString(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = typeof value === "number" ? new Date(value) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

export function normalizeWorkerAbsenceRecord(absence = {}) {
  const id = cleanString(absence.id);
  if (!id) throw new Error("worker_absence_id_required");
  const now = Date.now();
  const startsOn = dateOnlyOrNull(absence.from || absence.startsOn || absence.starts_on) || new Date(now).toISOString().slice(0, 10);
  const endsOn = dateOnlyOrNull(absence.to || absence.endsOn || absence.ends_on) || startsOn;
  return {
    id,
    userId: cleanString(absence.userId || absence.user_id) || null,
    userName: cleanString(absence.name || absence.userName || absence.user_name),
    startsOn,
    endsOn,
    reason: cleanString(absence.reason),
    createdAt: isoOrNull(absence.createdAt || absence.created_at || absence.at) || new Date(now).toISOString(),
    updatedAt: isoOrNull(absence.updatedAt || absence.updated_at || absence.at) || new Date(now).toISOString(),
    sourceKvKey: cleanString(absence.sourceKvKey || absence.source_kv_key || `cabsence:${id}`),
    legacyPayload: cleanObject(absence)
  };
}

export function workerAbsenceRecordToSupabaseRow(absence = {}) {
  const normalized = normalizeWorkerAbsenceRecord(absence);
  return {
    id: normalized.id,
    user_id: uuidOrNull(normalized.userId),
    user_name: normalized.userName,
    starts_on: normalized.startsOn,
    ends_on: normalized.endsOn,
    reason: normalized.reason,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function workerAbsenceRecordFromSupabaseRow(row = {}) {
  const legacy = cleanObject(row.legacy_payload);
  if (legacy.id) return legacy;
  const fallback = {
    id: row.id,
    userId: row.user_id,
    name: row.user_name,
    from: row.starts_on,
    to: row.ends_on,
    reason: row.reason,
    createdAt: row.created_at ? Date.parse(row.created_at) : undefined,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
    sourceKvKey: row.source_kv_key
  };
  return normalizeWorkerAbsenceRecord({ ...fallback, ...legacy }).legacyPayload;
}
