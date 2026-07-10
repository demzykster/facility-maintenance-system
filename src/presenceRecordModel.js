const cleanString = (value) => String(value == null ? "" : value).trim();
const cleanObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const isoOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const timestamp = (value) => {
  const iso = isoOrNull(value);
  return iso ? Date.parse(iso) : undefined;
};

export function normalizePresenceRecord(record = {}) {
  const id = cleanString(record.id || record.userId || record.user_id);
  if (!id) throw new Error("presence_id_required");
  const now = Date.now();
  const lastSeenAt = isoOrNull(record.lastSeen || record.last_seen_at || record.updatedAt || record.updated_at) || new Date(now).toISOString();
  return {
    id,
    name: cleanString(record.name || record.display_name),
    onShift: Boolean(record.onShift ?? record.on_shift),
    since: isoOrNull(record.since || record.since_at),
    endedAt: isoOrNull(record.endedAt || record.ended_at),
    lastSeenAt,
    day: cleanString(record.day) || lastSeenAt.slice(0, 10),
    sourceKvKey: cleanString(record.sourceKvKey || record.source_kv_key || `presence:${id}`),
    legacyPayload: cleanObject(record)
  };
}

export function presenceRecordToSupabaseRow(record = {}) {
  const normalized = normalizePresenceRecord(record);
  return {
    id: normalized.id,
    display_name: normalized.name,
    on_shift: normalized.onShift,
    since_at: normalized.since,
    ended_at: normalized.endedAt,
    last_seen_at: normalized.lastSeenAt,
    day: normalized.day,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function presenceRecordFromSupabaseRow(row = {}) {
  const legacy = cleanObject(row.legacy_payload);
  if (legacy.id) return legacy;
  return normalizePresenceRecord({
    id: row.id,
    name: row.display_name,
    onShift: row.on_shift,
    since: timestamp(row.since_at),
    endedAt: timestamp(row.ended_at),
    lastSeen: timestamp(row.last_seen_at),
    day: row.day,
    sourceKvKey: row.source_kv_key
  }).legacyPayload;
}
