import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { canCloseCleaningComplaints, canPerformCleaning } from "../../src/cleaningAccessModel.js";

const LEVEL_RANK = Object.freeze({
  none: 0,
  view: 1,
  request: 2,
  manage: 3,
  full: 4
});

const ACTIVE_ROLES = Object.freeze(["admin", "user", "tech", "worker", "cleaner"]);

const WRITE_RULES = Object.freeze([
  { prefixes: ["user:"], module: "users", minLevel: "manage", entityType: AUDIT_ENTITY_TYPES.user },
  { prefixes: ["config:v1"], module: "settings", minLevel: "manage", entityType: AUDIT_ENTITY_TYPES.settings },
  { prefixes: ["fleet:", "pm:", "insp:", "itpl:", "photo:"], module: "settings", minLevel: "manage", entityType: AUDIT_ENTITY_TYPES.fleet },
  { prefixes: ["ppe:", "ppeitem:", "ppenorm:", "ppeorder:"], module: "ppe", minLevel: "manage", entityType: AUDIT_ENTITY_TYPES.ppe },
  { prefixes: ["czone:", "cabsence:"], module: "settings", minLevel: "manage", entityType: AUDIT_ENTITY_TYPES.cleaning },
  { prefixes: ["location:"], module: "settings", minLevel: "manage", entityType: AUDIT_ENTITY_TYPES.settings },
  { prefixes: ["ticket:"], roles: ["admin", "user", "tech", "worker"], entityType: AUDIT_ENTITY_TYPES.ticket, auditSensitive: false },
  { prefixes: ["ppereq:"], module: "ppe", minLevel: "request", roles: ["worker", "cleaner"], entityType: AUDIT_ENTITY_TYPES.ppe, auditSensitive: false },
  { prefixes: ["cround:"], roles: ["admin", "user"], access: "cleaning:perform", entityType: AUDIT_ENTITY_TYPES.cleaning, auditSensitive: false },
  { prefixes: ["ccomplaint:"], roles: ["admin", "user"], access: "cleaning:closeComplaint", entityType: AUDIT_ENTITY_TYPES.cleaning, auditSensitive: false },
  { prefixes: ["presence:"], roles: ["admin", "tech"], entityType: AUDIT_ENTITY_TYPES.user, auditSensitive: false },
  { prefixes: ["mtask:", "mmeet:"], roles: ["admin", "user"], entityType: AUDIT_ENTITY_TYPES.settings, auditSensitive: false },
  { prefixes: ["controlProgram:", "controlAssignment:"], module: "controls", minLevel: "manage", entityType: AUDIT_ENTITY_TYPES.settings, auditSensitive: false },
  { prefixes: ["controlRun:", "controlFinding:"], module: "controls", minLevel: "request", entityType: AUDIT_ENTITY_TYPES.settings, auditSensitive: false },
  { prefixes: ["appIssue:"], roles: ACTIVE_ROLES, entityType: AUDIT_ENTITY_TYPES.settings, auditSensitive: false }
]);

const DEFAULT_WRITE_RULE = Object.freeze({
  prefixes: [],
  module: "settings",
  minLevel: "manage",
  entityType: AUDIT_ENTITY_TYPES.settings,
  unknown: true
});

export function kvWritePermissionForKey(key = "") {
  const recordKey = String(key || "");
  return WRITE_RULES.find((rule) => rule.prefixes.some((prefix) => recordKey.startsWith(prefix))) || DEFAULT_WRITE_RULE;
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
  if (session.role === "admin") return true;
  const hasModulePermission = rule.module
    ? permissionLevelRank(sessionPermissionLevel(session, rule.module)) >= permissionLevelRank(rule.minLevel)
    : false;
  const hasRolePermission = Array.isArray(rule.roles) && rule.roles.includes(session.role);
  const hasAccessPermission = rule.access === "cleaning:perform"
    ? canPerformCleaning(session)
    : rule.access === "cleaning:closeComplaint"
      ? canCloseCleaningComplaints(session)
      : false;
  return hasModulePermission || hasRolePermission || hasAccessPermission;
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
  if (rule.module) return `permission_required:${rule.module}:${rule.minLevel}`;
  if (rule.access) return `permission_required:${rule.access}`;
  return `permission_required:role:${(rule.roles || []).join("|")}`;
}

export function sensitiveKvWriteAuditEvent({ key = "", method = "PUT", actor = {}, before = null, after = null, shared = false, at } = {}) {
  const rule = kvWritePermissionForKey(key);
  if (!rule || rule.auditSensitive === false) return null;
  const action = String(method).toUpperCase() === "DELETE" ? AUDIT_ACTIONS.delete : AUDIT_ACTIONS.update;
  const requiredPermission = rule.module ? `${rule.module}:${rule.minLevel}` : `role:${(rule.roles || []).join("|")}`;
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
    metadata: { key: String(key || ""), shared: Boolean(shared), requiredPermission }
  });
}
