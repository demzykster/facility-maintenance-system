const cleanString = (value) => String(value || "").trim();
const cleanObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

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
    assignee_id: normalized.assigneeId || null,
    assignee_name: normalized.assigneeName,
    reported_by_id: normalized.reportedById || null,
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
