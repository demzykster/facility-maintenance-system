const cleanString = (value) => String(value || "").trim();
const cleanObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const cleanArray = (value) => (Array.isArray(value) ? value : []);
const uuidOrNull = (value) => {
  const text = cleanString(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
};

const isoOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export function normalizeCleaningRoundRecord(round = {}) {
  const id = cleanString(round.id);
  if (!id) throw new Error("cleaning_round_id_required");
  const now = Date.now();
  return {
    id,
    zoneId: cleanString(round.zoneId || round.zone_id) || null,
    cleanerId: cleanString(round.byUid || round.cleanerId || round.cleaner_id) || null,
    cleanerName: cleanString(round.byName || round.cleanerName || round.cleaner_name),
    status: cleanString(round.status || round.type || "done"),
    roundAt: isoOrNull(round.at || round.roundAt || round.round_at),
    completedAt: isoOrNull(round.completedAt || round.completed_at || round.at),
    manualReason: cleanString(round.manualReason || round.manual_reason),
    issues: cleanArray(round.issues),
    checklist: cleanObject(round.items || round.checklist),
    createdAt: isoOrNull(round.createdAt || round.created_at) || new Date(now).toISOString(),
    updatedAt: isoOrNull(round.updatedAt || round.updated_at) || new Date(now).toISOString(),
    sourceKvKey: cleanString(round.sourceKvKey || `cround:${id}`),
    legacyPayload: cleanObject(round)
  };
}

export function cleaningRoundRecordToSupabaseRow(round = {}) {
  const normalized = normalizeCleaningRoundRecord(round);
  return {
    id: normalized.id,
    zone_id: normalized.zoneId,
    cleaner_id: uuidOrNull(normalized.cleanerId),
    cleaner_name: normalized.cleanerName,
    status: normalized.status,
    round_at: normalized.roundAt,
    completed_at: normalized.completedAt,
    manual_reason: normalized.manualReason,
    issues: normalized.issues,
    checklist: normalized.checklist,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function cleaningRoundRecordFromSupabaseRow(row = {}) {
  const legacy = cleanObject(row.legacy_payload);
  if (legacy.id) return legacy;
  const fallback = {
    id: row.id,
    zoneId: row.zone_id,
    cleanerId: row.cleaner_id,
    cleanerName: row.cleaner_name,
    status: row.status,
    at: row.round_at ? Date.parse(row.round_at) : undefined,
    completedAt: row.completed_at ? Date.parse(row.completed_at) : undefined,
    manualReason: row.manual_reason,
    issues: cleanArray(row.issues),
    items: cleanObject(row.checklist),
    createdAt: row.created_at ? Date.parse(row.created_at) : undefined,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
    sourceKvKey: row.source_kv_key
  };
  return normalizeCleaningRoundRecord({ ...fallback, ...legacy }).legacyPayload;
}
