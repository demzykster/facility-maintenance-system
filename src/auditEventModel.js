export const AUDIT_ENTITY_TYPES = Object.freeze({
  ticket: "ticket",
  user: "user",
  permission: "permission",
  settings: "settings",
  file: "file",
  fleet: "fleet",
  cleaning: "cleaning",
  ppe: "ppe",
  system: "system"
});

export const AUDIT_ACTIONS = Object.freeze({
  create: "create",
  update: "update",
  delete: "delete",
  restore: "restore",
  statusChange: "status_change",
  permissionChange: "permission_change",
  upload: "upload",
  download: "download",
  login: "login",
  logout: "logout",
  bootstrap: "bootstrap"
});

const ENTITY_TYPES = new Set(Object.values(AUDIT_ENTITY_TYPES));
const ACTIONS = new Set(Object.values(AUDIT_ACTIONS));

const cleanString = (value) => String(value || "").trim();
const cleanObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

export const auditEventId = ({ at, actorId, entityType, entityId, action }) => (
  [at || Date.now(), actorId || "system", entityType, entityId || "global", action].map((part) => cleanString(part).replace(/[:\s]+/g, "-")).join(":")
);

export function normalizeAuditEvent(input = {}) {
  const entityType = cleanString(input.entityType);
  const action = cleanString(input.action);
  if (!ENTITY_TYPES.has(entityType)) throw new Error("audit_entity_type_invalid");
  if (!ACTIONS.has(action)) throw new Error("audit_action_invalid");

  const at = Number(input.at || Date.now());
  const actorId = cleanString(input.actorId);
  const entityId = cleanString(input.entityId);
  return {
    id: cleanString(input.id) || auditEventId({ at, actorId, entityType, entityId, action }),
    at,
    actorId,
    actorName: cleanString(input.actorName),
    actorRole: cleanString(input.actorRole),
    entityType,
    entityId,
    action,
    summary: cleanString(input.summary),
    before: cleanObject(input.before),
    after: cleanObject(input.after),
    metadata: cleanObject(input.metadata)
  };
}

export function ticketStatusAuditEvent(ticket = {}, previousStatus = "", nextStatus = "", actor = {}, options = {}) {
  return normalizeAuditEvent({
    at: options.at || ticket.updatedAt,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    entityType: AUDIT_ENTITY_TYPES.ticket,
    entityId: ticket.id,
    action: AUDIT_ACTIONS.statusChange,
    summary: `Ticket status changed from ${previousStatus || "unknown"} to ${nextStatus || "unknown"}`,
    before: { status: previousStatus || "" },
    after: { status: nextStatus || "" },
    metadata: { track: ticket.track || "", num: ticket.num || null }
  });
}

export function permissionAuditEvent(user = {}, beforePerms = {}, afterPerms = {}, actor = {}, options = {}) {
  return normalizeAuditEvent({
    at: options.at,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    entityType: AUDIT_ENTITY_TYPES.permission,
    entityId: user.id,
    action: AUDIT_ACTIONS.permissionChange,
    summary: `Permissions changed for ${user.name || user.id || "user"}`,
    before: beforePerms,
    after: afterPerms,
    metadata: { targetName: user.name || "", targetRole: user.role || "" }
  });
}

export function settingsAuditEvent(settingKey = "", beforeValue = null, afterValue = null, actor = {}, options = {}) {
  return normalizeAuditEvent({
    at: options.at,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    entityType: AUDIT_ENTITY_TYPES.settings,
    entityId: cleanString(settingKey),
    action: AUDIT_ACTIONS.update,
    summary: `Setting updated: ${cleanString(settingKey)}`,
    before: { value: beforeValue },
    after: { value: afterValue },
    metadata: options.metadata
  });
}

export function fileAuditEvent(file = {}, action = AUDIT_ACTIONS.upload, actor = {}, options = {}) {
  return normalizeAuditEvent({
    at: options.at || file.createdAt,
    actorId: actor.id || file.createdById,
    actorName: actor.name || file.createdByName,
    actorRole: actor.role || file.createdByRole,
    entityType: AUDIT_ENTITY_TYPES.file,
    entityId: file.id || file.path,
    action,
    summary: `File ${action}: ${file.path || file.id || "unknown"}`,
    before: options.before,
    after: { path: file.path || "", kind: file.kind || "", ownerType: file.ownerType || "", ownerId: file.ownerId || "" },
    metadata: { contentType: file.contentType || "", bucket: file.bucket || "" }
  });
}

export const AUDIT_EVENTS_TABLE_CONTRACT = Object.freeze([
  "id",
  "at",
  "actor_id",
  "actor_name",
  "actor_role",
  "entity_type",
  "entity_id",
  "action",
  "summary",
  "before",
  "after",
  "metadata"
]);
