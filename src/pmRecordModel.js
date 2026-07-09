const cleanString = (value) => String(value || "").trim();
const cleanObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const isoOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export function normalizePmRecord(task = {}) {
  const id = cleanString(task.id);
  if (!id) throw new Error("pm_id_required");
  const now = Date.now();
  return {
    id,
    fleetUnitId: cleanString(task.fleetUnitId || task.forkliftId || task.unitId),
    title: cleanString(task.title || task.maintenanceRuleName || "טיפול תקופתי"),
    frequency: cleanString(task.frequency),
    active: task.active !== false,
    nextDue: isoOrNull(task.nextDue || task.next_due),
    createdAt: isoOrNull(task.createdAt || task.created_at) || new Date(now).toISOString(),
    updatedAt: isoOrNull(task.updatedAt || task.updated_at) || new Date(now).toISOString(),
    sourceKvKey: cleanString(task.sourceKvKey || `pm:${id}`),
    legacyPayload: cleanObject(task)
  };
}

export function pmRecordToSupabaseRow(task = {}) {
  const normalized = normalizePmRecord(task);
  return {
    id: normalized.id,
    fleet_unit_id: normalized.fleetUnitId,
    title: normalized.title,
    frequency: normalized.frequency,
    active: normalized.active,
    next_due: normalized.nextDue,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function pmRecordFromSupabaseRow(row = {}) {
  const legacy = cleanObject(row.legacy_payload);
  if (legacy.id) return legacy;
  const fallback = {
    id: row.id,
    fleetUnitId: row.fleet_unit_id,
    forkliftId: row.fleet_unit_id,
    title: row.title,
    frequency: row.frequency,
    active: row.active !== false,
    nextDue: row.next_due ? Date.parse(row.next_due) : undefined,
    createdAt: row.created_at ? Date.parse(row.created_at) : undefined,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
    sourceKvKey: row.source_kv_key
  };
  return normalizePmRecord({ ...fallback, ...legacy }).legacyPayload;
}
