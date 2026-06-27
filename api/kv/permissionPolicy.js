const LEVEL_RANK = Object.freeze({
  none: 0,
  view: 1,
  request: 2,
  manage: 3,
  full: 4
});

const WRITE_RULES = Object.freeze([
  { prefixes: ["user:"], module: "users", minLevel: "manage" },
  { prefixes: ["config:v1"], module: "settings", minLevel: "manage" },
  { prefixes: ["fleet:", "pm:", "insp:", "itpl:"], module: "settings", minLevel: "manage" },
  { prefixes: ["ppe:", "ppeitem:", "ppenorm:", "ppeorder:"], module: "ppe", minLevel: "manage" },
  { prefixes: ["czone:", "cabsence:"], module: "settings", minLevel: "manage" }
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

export function kvWritePermissionError(session = {}, key = "") {
  const rule = kvWritePermissionForKey(key);
  if (!rule || sessionHasKvWritePermission(session, key)) return null;
  return `permission_required:${rule.module}:${rule.minLevel}`;
}
