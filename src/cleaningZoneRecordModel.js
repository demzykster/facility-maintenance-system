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

export function normalizeCleaningZoneRecord(zone = {}) {
  const id = cleanString(zone.id);
  if (!id) throw new Error("cleaning_zone_id_required");
  const now = Date.now();
  return {
    id,
    name: cleanString(zone.name),
    building: cleanString(zone.building),
    floor: cleanString(zone.floor),
    areaName: cleanString(zone.areaName || zone.area_name || zone.area || zone.building),
    cleanerId: cleanString(zone.cleanerId || zone.cleaner_id) || null,
    cleanerName: cleanString(zone.cleanerName || zone.cleaner_name),
    active: zone.active !== false,
    checklist: cleanArray(zone.checklist),
    windows: cleanArray(zone.windows),
    createdAt: isoOrNull(zone.createdAt || zone.created_at) || new Date(now).toISOString(),
    updatedAt: isoOrNull(zone.updatedAt || zone.updated_at) || new Date(now).toISOString(),
    sourceKvKey: cleanString(zone.sourceKvKey || `czone:${id}`),
    legacyPayload: cleanObject(zone)
  };
}

export function cleaningZoneRecordToSupabaseRow(zone = {}) {
  const normalized = normalizeCleaningZoneRecord(zone);
  return {
    id: normalized.id,
    name: normalized.name,
    building: normalized.building,
    floor: normalized.floor,
    area_name: normalized.areaName,
    cleaner_id: uuidOrNull(normalized.cleanerId),
    cleaner_name: normalized.cleanerName,
    active: normalized.active,
    checklist: normalized.checklist,
    windows: normalized.windows,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function cleaningZoneRecordFromSupabaseRow(row = {}) {
  const legacy = cleanObject(row.legacy_payload);
  if (legacy.id) return legacy;
  const fallback = {
    id: row.id,
    name: row.name,
    building: row.building,
    floor: row.floor,
    areaName: row.area_name,
    cleanerId: row.cleaner_id,
    cleanerName: row.cleaner_name,
    active: row.active,
    checklist: cleanArray(row.checklist),
    windows: cleanArray(row.windows),
    createdAt: row.created_at ? Date.parse(row.created_at) : undefined,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
    sourceKvKey: row.source_kv_key
  };
  return normalizeCleaningZoneRecord({ ...fallback, ...legacy }).legacyPayload;
}
