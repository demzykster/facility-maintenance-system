export const LOCATION_TYPES = [
  "warehouse",
  "yard",
  "office",
  "canteen",
  "dock",
  "parking",
  "machine_area",
  "safety_point",
  "general"
];

const cleanString = (value) => {
  const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  return text || "";
};

const compactIdPart = (value) => {
  const text = encodeURIComponent(cleanString(value).toLowerCase())
    .replace(/%/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return text.slice(0, 80) || "general";
};

export const normalizeLocationType = (type) => {
  const value = cleanString(type);
  return LOCATION_TYPES.includes(value) ? value : "general";
};

const cleanStringArray = (values = []) =>
  [...new Set((Array.isArray(values) ? values : []).map(cleanString).filter(Boolean))];

const cleanObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function normalizeLocationRecord(location = {}) {
  const id = cleanString(location.id);
  const name = cleanString(location.name);
  if (!id) throw new Error("location_id_required");
  if (!name) throw new Error("location_name_required");
  return {
    ...location,
    id,
    name,
    type: normalizeLocationType(location.type),
    building: cleanString(location.building),
    floor: cleanString(location.floor),
    area: cleanString(location.area),
    parentId: cleanString(location.parentId) || null,
    active: location.active !== false,
    tags: cleanStringArray(location.tags),
    source: cleanObject(location.source),
    sourceKvKey: cleanString(location.sourceKvKey) || `location:${id}`,
    legacyPayload: location.legacyPayload && typeof location.legacyPayload === "object" ? location.legacyPayload : { ...location }
  };
}

export function locationRecordToSupabaseRow(location = {}) {
  const record = normalizeLocationRecord(location);
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    building: record.building,
    floor: record.floor,
    area: record.area,
    parent_id: record.parentId,
    active: record.active,
    tags: record.tags,
    source: record.source,
    source_kv_key: record.sourceKvKey,
    legacy_payload: record.legacyPayload
  };
}

export function locationRecordFromSupabaseRow(row = {}) {
  const legacy = cleanObject(row.legacy_payload);
  if (legacy.id) return legacy;
  return normalizeLocationRecord({
    ...legacy,
    id: row.id || legacy.id,
    name: row.name || legacy.name,
    type: row.type || legacy.type,
    building: row.building || legacy.building,
    floor: row.floor || legacy.floor,
    area: row.area || legacy.area,
    parentId: row.parent_id || legacy.parentId,
    active: row.active !== false,
    tags: Array.isArray(row.tags) ? row.tags : legacy.tags,
    source: cleanObject(row.source || legacy.source),
    sourceKvKey: row.source_kv_key || legacy.sourceKvKey,
    legacyPayload: legacy
  });
}

export const locationDisplayText = (location = {}) => {
  const parts = [
    cleanString(location.name),
    cleanString(location.building),
    cleanString(location.floor),
    cleanString(location.area)
  ].filter(Boolean);
  return parts.join(" · ");
};

export const legacyZoneLocationId = (zoneName) => `legacy-zone:${compactIdPart(zoneName)}`;

export const locationFromLegacyZoneName = (zoneName, options = {}) => {
  const name = cleanString(zoneName);
  if (!name) return null;
  return {
    id: options.id || legacyZoneLocationId(name),
    name,
    type: normalizeLocationType(options.type),
    building: cleanString(options.building),
    floor: cleanString(options.floor),
    area: cleanString(options.area),
    parentId: cleanString(options.parentId) || null,
    active: options.active !== false,
    tags: [...new Set([...(options.tags || []), "legacy-zone"].map(cleanString).filter(Boolean))],
    source: { module: "maintenance", kind: "config.zones", value: name }
  };
};

export const locationsFromLegacyZoneNames = (zones = []) =>
  [...new Set((zones || []).map(cleanString).filter(Boolean))]
    .map((zoneName) => locationFromLegacyZoneName(zoneName));

export const baseLocationFromCleaningZone = (zone = {}) => {
  const id = cleanString(zone.locationId) || cleanString(zone.id);
  const name = cleanString(zone.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    type: normalizeLocationType(zone.type),
    building: cleanString(zone.building),
    floor: cleanString(zone.floor),
    area: cleanString(zone.area),
    parentId: cleanString(zone.parentId) || null,
    active: zone.active !== false,
    tags: [...new Set([...(zone.tags || []), "cleaning"].map(cleanString).filter(Boolean))],
    source: { module: "cleaning", kind: "czone", id: cleanString(zone.id) }
  };
};

export const cleaningProfileFromZone = (zone = {}, managerIds = []) => {
  const base = baseLocationFromCleaningZone(zone);
  if (!base) return null;
  return {
    locationId: base.id,
    cleaningZoneId: cleanString(zone.id),
    checklist: Array.isArray(zone.checklist) ? zone.checklist : [],
    windows: Array.isArray(zone.windows) ? zone.windows : [],
    activeDays: Array.isArray(zone.activeDays) ? zone.activeDays : null,
    cleanerId: cleanString(zone.cleanerId) || "",
    cleanerName: cleanString(zone.cleanerName) || "",
    managerIds: [...new Set((managerIds || zone.managerIds || []).map(cleanString).filter(Boolean))],
    qrCode: cleanString(zone.code) || "",
    compliancePolicy: zone.compliancePolicy || null
  };
};
