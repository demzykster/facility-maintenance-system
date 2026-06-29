import { canManage, canRequest, canView, normalizePerms } from "./permissionModel.js";

export const NOTIFICATION_ACCESS_RULES = Object.freeze({
  new: { module: "fleetTickets", level: "view" },
  upd: { module: "fleetTickets", level: "view" },
  ready: { module: "fleetTickets", level: "view" },
  confirm: { module: "fleetTickets", level: "view" },
  sla: { module: "analytics", level: "view" },
  escalate: { module: "fleetTickets", level: "view" },
  task: { module: null, level: "view" },
  pm: { module: "fleetDocs", level: "view" },
  doc: { module: "fleetDocs", level: "view" },
  driver: { module: "fleet", level: "manage" },
  ppe: { module: "ppe", level: "request" },
  cleaning: { module: "cleaning", level: "view" },
  back: { module: "fleetTickets", level: "view" },
  system: { module: null, level: "view" }
});

export const NOTIFICATION_ACCESS_GROUPS = Object.freeze([
  { kind: "new", label: "קריאות חדשות", module: "fleetTickets" },
  { kind: "upd", label: "עדכוני קריאה", module: "fleetTickets" },
  { kind: "ready", label: "ממתינה לסגירה", module: "fleetTickets" },
  { kind: "confirm", label: "ממתינה לאישור / נוכחות", module: "fleetTickets" },
  { kind: "sla", label: "חריגת SLA", module: "analytics" },
  { kind: "escalate", label: "הסלמות", module: "fleetTickets" },
  { kind: "task", label: "מטלות ופגישות", module: null },
  { kind: "pm", label: "טיפולים תקופתיים", module: "fleetDocs" },
  { kind: "doc", label: "מסמכים ובקרת כלים", module: "fleetDocs" },
  { kind: "driver", label: "נהגים ושיבוצים", module: "fleet" },
  { kind: "ppe", label: "ביגוד עובדים", module: "ppe" },
  { kind: "cleaning", label: "ניקיון וסבבים", module: "cleaning" },
  { kind: "back", label: "סיום משמרת / החזרות", module: "fleetTickets" },
  { kind: "system", label: "מערכת", module: null }
]);

export function normalizeNotificationPrefs(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const enabled = source.enabled && typeof source.enabled === "object" ? source.enabled : source;
  return {
    enabled: Object.fromEntries(
      Object.keys(NOTIFICATION_ACCESS_RULES)
        .filter((kind) => typeof enabled[kind] === "boolean")
        .map((kind) => [kind, enabled[kind]])
    )
  };
}

export function notificationPrefsFromUser(user = {}) {
  return normalizeNotificationPrefs(user.notificationPrefs || user.notificationPreferences || user.notifyPrefs || {});
}

export function notificationSessionFromSubscription(subscriptionRecord = {}) {
  return {
    role: subscriptionRecord.userRole || subscriptionRecord.role || "",
    perms: normalizePerms({
      perms: subscriptionRecord.userPermissions || subscriptionRecord.permissions || subscriptionRecord.perms || {}
    })
  };
}

export function notificationAllowedByAccess(user = {}, kind = "system") {
  const role = user?.role || user?.userRole || "";
  if (role === "admin") return true;
  if (kind === "cleaning" && role === "cleaner") return true;
  if (["new", "upd", "ready", "confirm", "escalate", "back"].includes(kind) && ["user", "tech"].includes(role)) return true;
  if (["pm", "doc"].includes(kind) && ["user", "tech"].includes(role)) return true;
  if (kind === "driver" && role === "user") return true;
  if (kind === "task" || kind === "system") return true;
  const rule = NOTIFICATION_ACCESS_RULES[kind] || NOTIFICATION_ACCESS_RULES.system;
  if (!rule?.module) return true;
  if (rule.level === "manage") return canManage(user, rule.module);
  if (rule.level === "request") return canRequest(user, rule.module);
  return canView(user, rule.module);
}

export function notificationEnabledForUser(user = {}, kind = "system") {
  if (!notificationAllowedByAccess(user, kind)) return false;
  const prefs = notificationPrefsFromUser(user);
  if (Object.prototype.hasOwnProperty.call(prefs.enabled, kind)) return prefs.enabled[kind] === true;
  return true;
}
