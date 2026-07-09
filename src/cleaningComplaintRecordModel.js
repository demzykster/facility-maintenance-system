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

const booleanValue = (value) => value === true || value === "true" || value === "1" || value === 1;

export function normalizeCleaningComplaintRecord(complaint = {}) {
  const id = cleanString(complaint.id);
  if (!id) throw new Error("cleaning_complaint_id_required");
  const now = Date.now();
  const photoPath = cleanString(complaint.photoPath || complaint.photo_path || complaint.photo?.path || complaint.photo?.storagePath) || null;
  const complaintAt = isoOrNull(complaint.at || complaint.complaintAt || complaint.complaint_at) || new Date(now).toISOString();
  const resolvedAt = isoOrNull(complaint.resolvedAt || complaint.resolved_at);
  return {
    id,
    zoneId: cleanString(complaint.zoneId || complaint.zone_id) || null,
    zoneName: cleanString(complaint.zoneName || complaint.zone_name),
    status: cleanString(complaint.status || "pending"),
    kind: cleanString(complaint.kind),
    text: cleanString(complaint.text),
    ownerRole: cleanString(complaint.ownerRole || complaint.owner_role),
    reportedById: cleanString(complaint.reportedById || complaint.reported_by_id) || null,
    reportedByName: cleanString(complaint.reportedByName || complaint.reported_by_name),
    resolvedById: cleanString(complaint.resolvedById || complaint.resolved_by_id) || null,
    resolvedByName: cleanString(complaint.resolvedByName || complaint.resolvedBy || complaint.resolved_by_name),
    ticketId: cleanString(complaint.ticketId || complaint.ticket_id) || null,
    photoPath,
    hasPhoto: booleanValue(complaint.hasPhoto || complaint.has_photo) || !!photoPath || !!complaint.photo,
    verified: booleanValue(complaint.verified),
    complaintAt,
    resolvedAt,
    createdAt: isoOrNull(complaint.createdAt || complaint.created_at || complaint.at) || complaintAt,
    updatedAt: isoOrNull(complaint.updatedAt || complaint.updated_at || complaint.resolvedAt || complaint.at) || new Date(now).toISOString(),
    sourceKvKey: cleanString(complaint.sourceKvKey || complaint.source_kv_key || `ccomplaint:${id}`),
    legacyPayload: cleanObject(complaint)
  };
}

export function cleaningComplaintRecordToSupabaseRow(complaint = {}) {
  const normalized = normalizeCleaningComplaintRecord(complaint);
  return {
    id: normalized.id,
    zone_id: normalized.zoneId,
    zone_name: normalized.zoneName,
    status: normalized.status,
    kind: normalized.kind,
    text: normalized.text,
    owner_role: normalized.ownerRole,
    reported_by_id: uuidOrNull(normalized.reportedById),
    reported_by_name: normalized.reportedByName,
    resolved_by_id: uuidOrNull(normalized.resolvedById),
    resolved_by_name: normalized.resolvedByName,
    ticket_id: normalized.ticketId,
    photo_path: normalized.photoPath,
    has_photo: normalized.hasPhoto,
    verified: normalized.verified,
    complaint_at: normalized.complaintAt,
    resolved_at: normalized.resolvedAt,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    source_kv_key: normalized.sourceKvKey,
    legacy_payload: normalized.legacyPayload
  };
}

export function cleaningComplaintRecordFromSupabaseRow(row = {}) {
  const legacy = cleanObject(row.legacy_payload);
  if (legacy.id) return legacy;
  const fallback = {
    id: row.id,
    zoneId: row.zone_id,
    zoneName: row.zone_name,
    status: row.status,
    kind: row.kind,
    text: row.text,
    ownerRole: row.owner_role,
    reportedById: row.reported_by_id,
    reportedByName: row.reported_by_name,
    resolvedById: row.resolved_by_id,
    resolvedByName: row.resolved_by_name,
    ticketId: row.ticket_id,
    photoPath: row.photo_path,
    hasPhoto: row.has_photo,
    verified: row.verified,
    at: row.complaint_at ? Date.parse(row.complaint_at) : undefined,
    resolvedAt: row.resolved_at ? Date.parse(row.resolved_at) : undefined,
    createdAt: row.created_at ? Date.parse(row.created_at) : undefined,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
    sourceKvKey: row.source_kv_key
  };
  return normalizeCleaningComplaintRecord({ ...fallback, ...legacy }).legacyPayload;
}
