const cleanString = (value) => String(value == null ? "" : value).trim();
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

const booleanValue = (value, fallback = false) => {
  if (value === true || value === "true" || value === "1" || value === 1) return true;
  if (value === false || value === "false" || value === "0" || value === 0) return false;
  return fallback;
};

const numberValue = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

export function normalizePpeMovementRecord(record = {}) {
  const id = cleanString(record.id);
  if (!id) throw new Error("ppe_movement_id_required");
  const now = Date.now();
  const movementAt = isoOrNull(record.movementAt || record.movement_at || record.at || record.createdAt) || new Date(now).toISOString();
  return {
    id,
    workerId: cleanString(record.workerId || record.worker_id) || null,
    workerName: cleanString(record.workerName || record.worker_name),
    itemId: cleanString(record.itemId || record.item_id) || null,
    itemName: cleanString(record.itemName || record.item_name),
    size: cleanString(record.size),
    qty: numberValue(record.qty, 0),
    movementType: cleanString(record.movementType || record.movement_type || record.type),
    movementAt,
    createdAt: isoOrNull(record.createdAt || record.created_at || record.at) || movementAt,
    updatedAt: isoOrNull(record.updatedAt || record.updated_at || record.at) || new Date(now).toISOString(),
    sourceKvKey: cleanString(record.sourceKvKey || record.source_kv_key || `ppe:${id}`),
    legacyPayload: cleanObject(record)
  };
}

export function ppeMovementRecordToSupabaseRow(record = {}) {
  const normalized = normalizePpeMovementRecord(record);
  return {
    id: normalized.id,
    worker_id: uuidOrNull(normalized.workerId),
    worker_name: normalized.workerName,
    item_id: normalized.itemId,
    item_name: normalized.itemName,
    size: normalized.size,
    qty: normalized.qty,
    movement_type: normalized.movementType,
    movement_at: normalized.movementAt,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function ppeMovementRecordFromSupabaseRow(row = {}) {
  return legacyOrFallback(row, {
    id: row.id,
    workerId: row.worker_id,
    workerName: row.worker_name,
    itemId: row.item_id,
    itemName: row.item_name,
    size: row.size,
    qty: row.qty,
    type: row.movement_type,
    at: timestamp(row.movement_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    sourceKvKey: row.source_kv_key
  }, normalizePpeMovementRecord);
}

export function normalizePpeItemRecord(record = {}) {
  const id = cleanString(record.id);
  if (!id) throw new Error("ppe_item_id_required");
  const now = Date.now();
  return {
    id,
    name: cleanString(record.name),
    category: cleanString(record.category),
    sku: cleanString(record.sku),
    active: booleanValue(record.active, true),
    sizes: cleanArray(record.sizes),
    stockBySize: cleanObject(record.stockBySize || record.stock_by_size),
    minBySize: cleanObject(record.minBySize || record.min_by_size),
    minStock: numberValue(record.minStock || record.min_stock, 0),
    unitCost: numberValue(record.unitCost || record.unit_cost, 0),
    createdAt: isoOrNull(record.createdAt || record.created_at) || new Date(now).toISOString(),
    updatedAt: isoOrNull(record.updatedAt || record.updated_at) || new Date(now).toISOString(),
    sourceKvKey: cleanString(record.sourceKvKey || record.source_kv_key || `ppeitem:${id}`),
    legacyPayload: cleanObject(record)
  };
}

export function ppeItemRecordToSupabaseRow(record = {}) {
  const normalized = normalizePpeItemRecord(record);
  return {
    id: normalized.id,
    name: normalized.name,
    category: normalized.category,
    sku: normalized.sku,
    active: normalized.active,
    sizes: normalized.sizes,
    stock_by_size: normalized.stockBySize,
    min_by_size: normalized.minBySize,
    min_stock: normalized.minStock,
    unit_cost: normalized.unitCost,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function ppeItemRecordFromSupabaseRow(row = {}) {
  return legacyOrFallback(row, {
    id: row.id,
    name: row.name,
    category: row.category,
    sku: row.sku,
    active: row.active,
    sizes: row.sizes,
    stockBySize: row.stock_by_size,
    minBySize: row.min_by_size,
    minStock: row.min_stock,
    unitCost: row.unit_cost,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    sourceKvKey: row.source_kv_key
  }, normalizePpeItemRecord);
}

export function normalizePpeNormRecord(record = {}) {
  const id = cleanString(record.id);
  if (!id) throw new Error("ppe_norm_id_required");
  const now = Date.now();
  return {
    id,
    dept: cleanString(record.dept || record.department),
    itemId: cleanString(record.itemId || record.item_id) || null,
    active: booleanValue(record.active, true),
    policy: cleanString(record.policy),
    workerPct: numberValue(record.workerPct || record.worker_pct, 0),
    periodMonths: numberValue(record.periodMonths || record.period_months, 0),
    createdAt: isoOrNull(record.createdAt || record.created_at) || new Date(now).toISOString(),
    updatedAt: isoOrNull(record.updatedAt || record.updated_at) || new Date(now).toISOString(),
    sourceKvKey: cleanString(record.sourceKvKey || record.source_kv_key || `ppenorm:${id}`),
    legacyPayload: cleanObject(record)
  };
}

export function ppeNormRecordToSupabaseRow(record = {}) {
  const normalized = normalizePpeNormRecord(record);
  return {
    id: normalized.id,
    dept: normalized.dept,
    item_id: normalized.itemId,
    active: normalized.active,
    policy: normalized.policy,
    worker_pct: normalized.workerPct,
    period_months: normalized.periodMonths,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function ppeNormRecordFromSupabaseRow(row = {}) {
  return legacyOrFallback(row, {
    id: row.id,
    dept: row.dept,
    itemId: row.item_id,
    active: row.active,
    policy: row.policy,
    workerPct: row.worker_pct,
    periodMonths: row.period_months,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    sourceKvKey: row.source_kv_key
  }, normalizePpeNormRecord);
}

export function normalizePpeRequestRecord(record = {}) {
  const id = cleanString(record.id);
  if (!id) throw new Error("ppe_request_id_required");
  const now = Date.now();
  const requestedAt = isoOrNull(record.requestedAt || record.requested_at || record.at || record.createdAt) || new Date(now).toISOString();
  return {
    id,
    workerId: cleanString(record.workerId || record.worker_id) || null,
    workerName: cleanString(record.workerName || record.worker_name),
    status: cleanString(record.status || "pending"),
    lines: cleanArray(record.lines),
    requestedAt,
    decidedAt: isoOrNull(record.decidedAt || record.decided_at),
    createdAt: isoOrNull(record.createdAt || record.created_at || record.at) || requestedAt,
    updatedAt: isoOrNull(record.updatedAt || record.updated_at || record.decidedAt || record.at) || new Date(now).toISOString(),
    sourceKvKey: cleanString(record.sourceKvKey || record.source_kv_key || `ppereq:${id}`),
    legacyPayload: cleanObject(record)
  };
}

export function ppeRequestRecordToSupabaseRow(record = {}) {
  const normalized = normalizePpeRequestRecord(record);
  return {
    id: normalized.id,
    worker_id: uuidOrNull(normalized.workerId),
    worker_name: normalized.workerName,
    status: normalized.status,
    lines: normalized.lines,
    requested_at: normalized.requestedAt,
    decided_at: normalized.decidedAt,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function ppeRequestRecordFromSupabaseRow(row = {}) {
  return legacyOrFallback(row, {
    id: row.id,
    workerId: row.worker_id,
    workerName: row.worker_name,
    status: row.status,
    lines: row.lines,
    at: timestamp(row.requested_at),
    decidedAt: timestamp(row.decided_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    sourceKvKey: row.source_kv_key
  }, normalizePpeRequestRecord);
}

export function normalizePpeOrderRecord(record = {}) {
  const id = cleanString(record.id);
  if (!id) throw new Error("ppe_order_id_required");
  const now = Date.now();
  const createdAt = isoOrNull(record.createdAt || record.created_at) || new Date(now).toISOString();
  return {
    id,
    supplier: cleanString(record.supplier),
    status: cleanString(record.status || "draft"),
    lines: cleanArray(record.lines),
    createdAt,
    sentAt: isoOrNull(record.sentAt || record.sent_at),
    receivedAt: isoOrNull(record.receivedAt || record.received_at),
    updatedAt: isoOrNull(record.updatedAt || record.updated_at || record.receivedAt || record.sentAt) || new Date(now).toISOString(),
    sourceKvKey: cleanString(record.sourceKvKey || record.source_kv_key || `ppeorder:${id}`),
    legacyPayload: cleanObject(record)
  };
}

export function ppeOrderRecordToSupabaseRow(record = {}) {
  const normalized = normalizePpeOrderRecord(record);
  return {
    id: normalized.id,
    supplier: normalized.supplier,
    status: normalized.status,
    lines: normalized.lines,
    created_at: normalized.createdAt,
    sent_at: normalized.sentAt,
    received_at: normalized.receivedAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function ppeOrderRecordFromSupabaseRow(row = {}) {
  return legacyOrFallback(row, {
    id: row.id,
    supplier: row.supplier,
    status: row.status,
    lines: row.lines,
    createdAt: timestamp(row.created_at),
    sentAt: timestamp(row.sent_at),
    receivedAt: timestamp(row.received_at),
    updatedAt: timestamp(row.updated_at),
    sourceKvKey: row.source_kv_key
  }, normalizePpeOrderRecord);
}
