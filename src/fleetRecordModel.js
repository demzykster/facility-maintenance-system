const cleanString = (value) => String(value || "").trim();
const cleanObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const isoOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export function normalizeFleetRecord(unit = {}) {
  const id = cleanString(unit.id);
  if (!id) throw new Error("fleet_id_required");
  const now = Date.now();
  const code = cleanString(unit.code || unit.num || unit.number || unit.unitCode || unit.workerNo || unit.workerNumber || unit.vehicleNo || unit.vehicleNumber || unit.registration || unit.registrationNumber || unit.licensePlate || unit.displayNumber || unit.displayNo || id);
  return {
    id,
    code,
    type: cleanString(unit.vehicleType || unit.kind || unit.type),
    model: cleanString(unit.model || unit.modelCode || unit.typeCode),
    supplier: cleanString(unit.supplier),
    department: cleanString(unit.department || unit.dept),
    location: cleanString(unit.location || unit.zone),
    status: cleanString(unit.status) || (unit.active === false ? "inactive" : "active"),
    createdAt: isoOrNull(unit.createdAt || unit.created_at) || new Date(now).toISOString(),
    updatedAt: isoOrNull(unit.updatedAt || unit.updated_at) || new Date(now).toISOString(),
    sourceKvKey: cleanString(unit.sourceKvKey || `fleet:${id}`),
    legacyPayload: cleanObject(unit)
  };
}

export function fleetRecordToSupabaseRow(unit = {}) {
  const normalized = normalizeFleetRecord(unit);
  return {
    id: normalized.id,
    code: normalized.code,
    vehicle_type: normalized.type,
    model: normalized.model,
    supplier: normalized.supplier,
    department: normalized.department,
    location: normalized.location,
    status: normalized.status,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function fleetRecordFromSupabaseRow(row = {}) {
  const legacy = cleanObject(row.legacy_payload);
  if (legacy.id) return legacy;
  const fallback = {
    id: row.id,
    code: row.code,
    vehicleType: row.vehicle_type,
    type: row.vehicle_type,
    model: row.model,
    supplier: row.supplier,
    department: row.department,
    dept: row.department,
    location: row.location,
    zone: row.location,
    status: row.status,
    createdAt: row.created_at ? Date.parse(row.created_at) : undefined,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
    sourceKvKey: row.source_kv_key
  };
  return normalizeFleetRecord({ ...fallback, ...legacy }).legacyPayload;
}
