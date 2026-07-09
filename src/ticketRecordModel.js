const cleanString = (value) => String(value || "").trim();
const cleanObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidOrNull = (value) => {
  const clean = cleanString(value);
  return UUID_PATTERN.test(clean) ? clean : null;
};

const isoOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export function normalizeTicketRecord(ticket = {}) {
  const id = cleanString(ticket.id);
  if (!id) throw new Error("ticket_id_required");
  const now = Date.now();
  return {
    id,
    num: Number.isFinite(Number(ticket.num)) ? Number(ticket.num) : null,
    track: cleanString(ticket.track),
    subject: cleanString(ticket.subject || ticket.title),
    description: cleanString(ticket.description || ticket.desc),
    status: cleanString(ticket.status) || "new",
    priority: cleanString(ticket.priority),
    category: cleanString(ticket.category || ticket.cat),
    location: cleanString(ticket.location || ticket.zone),
    assetId: cleanString(ticket.assetId || ticket.asset_id || ticket.fleetId),
    assigneeId: cleanString(ticket.assigneeId || ticket.assignee_id),
    assigneeName: cleanString(ticket.assignee || ticket.assigneeName),
    reportedById: cleanString(ticket.reportedBy?.id || ticket.reportedById || ticket.createdBy?.id),
    reportedByName: cleanString(ticket.reportedBy?.name || ticket.reportedByName || ticket.createdBy?.name),
    department: cleanString(ticket.department || ticket.dept),
    dueAt: isoOrNull(ticket.dueAt || ticket.due_at || ticket.slaDueAt),
    createdAt: isoOrNull(ticket.createdAt || ticket.created_at) || new Date(now).toISOString(),
    updatedAt: isoOrNull(ticket.updatedAt || ticket.updated_at) || new Date(now).toISOString(),
    closedAt: isoOrNull(ticket.closedAt || ticket.closed_at),
    sourceKvKey: cleanString(ticket.sourceKvKey || `ticket:${id}`),
    legacyPayload: cleanObject(ticket)
  };
}

export function ticketRecordToSupabaseRow(ticket = {}) {
  const normalized = normalizeTicketRecord(ticket);
  return {
    id: normalized.id,
    num: normalized.num,
    track: normalized.track,
    subject: normalized.subject,
    description: normalized.description,
    status: normalized.status,
    priority: normalized.priority,
    category: normalized.category,
    location: normalized.location,
    asset_id: normalized.assetId || null,
    assignee_id: uuidOrNull(normalized.assigneeId),
    assignee_name: normalized.assigneeName,
    reported_by_id: uuidOrNull(normalized.reportedById),
    reported_by_name: normalized.reportedByName,
    department: normalized.department,
    due_at: normalized.dueAt,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    closed_at: normalized.closedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function ticketRecordFromSupabaseRow(row = {}) {
  const legacy = cleanObject(row.legacy_payload);
  const fallback = {
    id: row.id,
    num: row.num,
    track: row.track,
    subject: row.subject,
    description: row.description,
    status: row.status,
    priority: row.priority,
    category: row.category,
    zone: row.location,
    assetId: row.asset_id,
    assigneeId: row.assignee_id,
    assignee: row.assignee_name,
    reportedBy: row.reported_by_id || row.reported_by_name ? {
      id: row.reported_by_id,
      name: row.reported_by_name
    } : undefined,
    department: row.department,
    dueAt: row.due_at ? Date.parse(row.due_at) : null,
    createdAt: row.created_at ? Date.parse(row.created_at) : undefined,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
    closedAt: row.closed_at ? Date.parse(row.closed_at) : null,
    sourceKvKey: row.source_kv_key
  };
  const merged = { ...fallback, ...legacy };
  return normalizeTicketRecord(merged).legacyPayload;
}
