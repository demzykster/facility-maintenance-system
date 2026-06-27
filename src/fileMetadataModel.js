export const FILE_OWNER_TYPES = Object.freeze({
  ticket: "ticket",
  cleaningComplaint: "cleaning_complaint",
  cleaningRound: "cleaning_round",
  user: "user",
  fleet: "fleet",
  supplier: "supplier",
  system: "system"
});

export const FILE_KINDS = Object.freeze({
  ticketBeforePhoto: "ticket_before_photo",
  ticketAfterPhoto: "ticket_after_photo",
  cleaningComplaintPhoto: "cleaning_complaint_photo",
  cleaningRoundIssuePhoto: "cleaning_round_issue_photo",
  attachment: "attachment",
  document: "document"
});

const KNOWN_OWNER_TYPES = new Set(Object.values(FILE_OWNER_TYPES));
const KNOWN_KINDS = new Set(Object.values(FILE_KINDS));

const cleanString = (value) => String(value || "").trim();

export const fileMetadataId = ({ ownerType, ownerId, kind, ownerSubId = "", path }) => (
  [ownerType, ownerId, kind, ownerSubId, path].map((part) => cleanString(part).replace(/[:\s]+/g, "-")).filter(Boolean).join(":")
);

export function normalizeFileMetadata(input = {}) {
  const ownerType = cleanString(input.ownerType);
  const ownerId = cleanString(input.ownerId);
  const kind = cleanString(input.kind);
  const path = cleanString(input.path);
  if (!KNOWN_OWNER_TYPES.has(ownerType)) throw new Error("file_owner_type_invalid");
  if (!ownerId) throw new Error("file_owner_id_required");
  if (!KNOWN_KINDS.has(kind)) throw new Error("file_kind_invalid");
  if (!path || path.includes("..") || path.startsWith("/")) throw new Error("file_path_invalid");

  const ownerSubId = cleanString(input.ownerSubId);
  const createdAt = Number(input.createdAt || Date.now());
  return {
    id: cleanString(input.id) || fileMetadataId({ ownerType, ownerId, kind, ownerSubId, path }),
    ownerType,
    ownerId,
    ownerSubId,
    kind,
    path,
    contentType: cleanString(input.contentType) || "application/octet-stream",
    storageProvider: cleanString(input.storageProvider) || "supabase",
    bucket: cleanString(input.bucket) || "cmms-files",
    sizeBytes: Math.max(0, Number(input.sizeBytes || 0)),
    createdById: cleanString(input.createdById),
    createdByName: cleanString(input.createdByName),
    createdByRole: cleanString(input.createdByRole),
    createdAt,
    deletedAt: input.deletedAt ? Number(input.deletedAt) : null
  };
}

export function ticketPhotoMetadata(ticket = {}, kind = "before", path = "", options = {}) {
  const isAfter = kind === "after";
  return normalizeFileMetadata({
    ownerType: FILE_OWNER_TYPES.ticket,
    ownerId: ticket.id,
    kind: isAfter ? FILE_KINDS.ticketAfterPhoto : FILE_KINDS.ticketBeforePhoto,
    path,
    contentType: options.contentType,
    sizeBytes: options.sizeBytes,
    createdById: options.createdById || ticket.createdBy?.id,
    createdByName: options.createdByName || ticket.createdBy?.name,
    createdByRole: options.createdByRole || ticket.createdBy?.role,
    createdAt: options.createdAt || ticket.updatedAt || ticket.createdAt
  });
}

export function cleaningComplaintPhotoMetadata(complaint = {}, path = "", options = {}) {
  return normalizeFileMetadata({
    ownerType: FILE_OWNER_TYPES.cleaningComplaint,
    ownerId: complaint.id,
    kind: FILE_KINDS.cleaningComplaintPhoto,
    path,
    contentType: options.contentType,
    sizeBytes: options.sizeBytes,
    createdById: options.createdById || complaint.reportedById,
    createdByName: options.createdByName || complaint.reportedByName,
    createdByRole: options.createdByRole || complaint.reportedByRole,
    createdAt: options.createdAt || complaint.at
  });
}

export function cleaningRoundIssuePhotoMetadata(round = {}, issue = {}, path = "", options = {}) {
  return normalizeFileMetadata({
    ownerType: FILE_OWNER_TYPES.cleaningRound,
    ownerId: round.id,
    ownerSubId: issue.id || issue.itemId,
    kind: FILE_KINDS.cleaningRoundIssuePhoto,
    path,
    contentType: options.contentType,
    sizeBytes: options.sizeBytes,
    createdById: options.createdById || round.byUid,
    createdByName: options.createdByName || round.byName,
    createdByRole: options.createdByRole || round.byRole,
    createdAt: options.createdAt || round.at
  });
}

export const FILE_METADATA_TABLE_CONTRACT = Object.freeze([
  "id",
  "owner_type",
  "owner_id",
  "owner_sub_id",
  "kind",
  "path",
  "content_type",
  "storage_provider",
  "bucket",
  "size_bytes",
  "created_by_id",
  "created_by_name",
  "created_by_role",
  "created_at",
  "deleted_at"
]);
