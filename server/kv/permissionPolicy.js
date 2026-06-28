import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";

const LEVEL_RANK = Object.freeze({
  none: 0,
  view: 1,
  request: 2,
  manage: 3,
  full: 4
});

const WRITE_RULES = Object.freeze([
  { prefixes: ["user:"], module: "users", minLevel: "manage", entityType: AUDIT_ENTITY_TYPES.user },
  { prefixes: ["config:v1"], module: "settings", minLevel: "manage", entityType: AUDIT_ENTITY_TYPES.settings },
  { prefixes: ["fleet:", "pm:", "insp:", "itpl:"], module: "settings", minLevel: "manage", entityType: AUDIT_ENTITY_TYPES.fleet },
  { prefixes: ["ppe:", "ppeitem:", "ppenorm:", "ppeorder:"], module: "ppe", minLevel: "manage", entityType: AUDIT_ENTITY_TYPES.ppe },
  { prefixes: ["czone:", "cabsence:"], module: "settings", minLevel: "manage", entityType: AUDIT_ENTITY_TYPES.cleaning }
]);

export function kvWritePermissionForKey(key = "") {
  const recordKey = String(key || "");
  return WRITE_RULES.find((rule) => rule.prefixes.some((prefix) => recordKey.startsWith(prefix))) || null;
}

export function permissionLevelRank(level) {
  return LEVEL_RANK[level] ?? 0;
}

export function sessionPermissionLevel(session = {}, module) {
  if (session.role === "admin") return "full";
  return session.permissions?.[module] || session.perms?.[module] || "none";
}

export function sessionHasKvWritePermission(session = {}, key = "") {
  const rule = kvWritePermissionForKey(key);
  if (!rule) return true;
  return permissionLevelRank(sessionPermissionLevel(session, rule.module)) >= permissionLevelRank(rule.minLevel);
}

export function sessionCanReadUserSecrets(session = {}) {
  if (session.role === "admin") return true;
  return permissionLevelRank(sessionPermissionLevel(session, "users")) >= permissionLevelRank("manage")
    || permissionLevelRank(sessionPermissionLevel(session, "workerAccess")) >= permissionLevelRank("manage");
}

const USER_SECRET_FIELDS = Object.freeze([
  "password",
  "pin",
  "activationToken",
  "activationTokenExpiresAt",
  "resetToken",
  "resetCode",
  "passwordHash",
  "pinHash",
  "temporaryPassword",
  "tempPassword"
]);

export function redactUserSecrets(record = {}) {
  const clean = { ...(record || {}) };
  USER_SECRET_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(clean, field)) delete clean[field];
  });
  return clean;
}

export function kvReadValueForSession({ key = "", value = null, session = {} } = {}) {
  if (!String(key || "").startsWith("user:") || sessionCanReadUserSecrets(session)) return value;
  if (!value || typeof value !== "string") return value;
  try {
    return JSON.stringify(redactUserSecrets(JSON.parse(value)));
  } catch {
    return value;
  }
}

export function kvWritePermissionError(session = {}, key = "") {
  const rule = kvWritePermissionForKey(key);
  if (!rule || sessionHasKvWritePermission(session, key)) return null;
  return `permission_required:${rule.module}:${rule.minLevel}`;
}

export function sensitiveKvWriteAuditEvent({ key = "", method = "PUT", actor = {}, before = null, after = null, shared = false, at } = {}) {
  const rule = kvWritePermissionForKey(key);
  if (!rule) return null;
  const action = String(method).toUpperCase() === "DELETE" ? AUDIT_ACTIONS.delete : AUDIT_ACTIONS.update;
  return normalizeAuditEvent({
    at,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    entityType: rule.entityType,
    entityId: String(key || ""),
    action,
    summary: `Sensitive KV ${action}: ${key}`,
    before: before === null || before === undefined ? {} : { value: before },
    after: after === null || after === undefined ? {} : { value: after },
    metadata: { key: String(key || ""), shared: Boolean(shared), requiredPermission: `${rule.module}:${rule.minLevel}` }
  });
}
