const truthy = new Set(["1", "true", "yes", "on", "enabled"]);
const managementRoles = new Set(["admin", "executive", "user"]);

export const AI_AUTONOMOUS_TICKET_CREATE_PERMISSION = "aiAutonomousTicketCreate";
export const AI_AUTONOMOUS_TICKET_CREATE_PERMISSION_LEVEL = "request";

const cleanText = (value, limit = 120) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase()
  .slice(0, limit);

export function autonomousTicketCreateEnabled(env = {}) {
  const raw = cleanText(env.CMMS_AI_AUTONOMOUS_TICKET_CREATE);
  if (!raw || raw === "false" || raw === "0" || raw === "off" || raw === "disabled") return false;
  if (truthy.has(raw)) return true;

  const appMode = cleanText(env.CMMS_APP_MODE || env.VITE_CMMS_APP_MODE || env.NODE_ENV);
  if (raw === "test") return appMode === "test" || env.NODE_ENV === "test";
  if (raw === "local") return ["local", "demo", "development", "test"].includes(appMode) || env.NODE_ENV === "test";
  if (raw === "staging") return appMode === "staging";
  if (raw === "production") return appMode === "production";

  return false;
}

function actorPermissions(actor = {}) {
  if (actor?.permissions && typeof actor.permissions === "object" && !Array.isArray(actor.permissions)) return actor.permissions;
  if (actor?.perms && typeof actor.perms === "object" && !Array.isArray(actor.perms)) return actor.perms;
  return {};
}

export function aiAutonomousTicketCreatePermissionLevel(actor = {}) {
  return String(actorPermissions(actor)[AI_AUTONOMOUS_TICKET_CREATE_PERMISSION] || "none").trim();
}

export function aiAutonomousTicketCreatePermitted(actor = {}) {
  const role = cleanText(actor.role, 40);
  const active = actor.active !== false && cleanText(actor.status, 40) !== "inactive" && cleanText(actor.status, 40) !== "archived";
  return active
    && managementRoles.has(role)
    && aiAutonomousTicketCreatePermissionLevel(actor) === AI_AUTONOMOUS_TICKET_CREATE_PERMISSION_LEVEL;
}

export function aiAutonomousTicketCreateAccessStatus(env = {}, actor = {}) {
  const globalEnabled = autonomousTicketCreateEnabled(env);
  const permissionLevel = aiAutonomousTicketCreatePermissionLevel(actor);
  const permitted = aiAutonomousTicketCreatePermitted(actor);
  return {
    globalEnabled,
    permissionKey: AI_AUTONOMOUS_TICKET_CREATE_PERMISSION,
    permissionLevel,
    permissionRequired: AI_AUTONOMOUS_TICKET_CREATE_PERMISSION_LEVEL,
    permitted,
    effectiveAccess: globalEnabled && permitted
  };
}
