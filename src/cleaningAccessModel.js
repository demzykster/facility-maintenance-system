const CLEANING_GROUP_IDS = new Set(["cleaning-team", "cleaning", "cleaners"]);

const LEVEL_RANK = Object.freeze({
  none: 0,
  view: 1,
  request: 2,
  manage: 3,
  full: 4
});

const cleanString = (value) => String(value == null ? "" : value).trim();

const truthy = (value) => value === true || value === "true" || value === "yes" || value === 1;

const permissionLevel = (user = {}, module) => {
  if (user.role === "admin") return "full";
  return user.permissions?.[module] || user.perms?.[module] || "none";
};

const hasPermission = (user = {}, module, minLevel = "view") =>
  (LEVEL_RANK[permissionLevel(user, module)] ?? 0) >= (LEVEL_RANK[minLevel] ?? 0);

const groupIdsOf = (user = {}) => [
  ...(Array.isArray(user.groups) ? user.groups : []),
  ...(Array.isArray(user.userGroups) ? user.userGroups : []),
  ...(Array.isArray(user.groupIds) ? user.groupIds : [])
].map(cleanString).filter(Boolean);

const hasCleaningGroup = (user = {}) => groupIdsOf(user).some((id) => CLEANING_GROUP_IDS.has(id));

export const isLegacyCleanerRole = (user = {}) => (user.role || user.userRole) === "cleaner";

export const isWorkerLike = (user = {}) => ["worker", "cleaner"].includes(user.role || user.userRole || "");

export const normalizeCleaningAccess = (user = {}) => {
  const raw = user.cleaningAccess ?? user.cleaning ?? {};
  const objectAccess = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const enabledByFlag = truthy(raw) || truthy(user.canClean) || truthy(user.isCleaner);
  const enabled = user.active === false
    ? false
    : isLegacyCleanerRole(user) || enabledByFlag || hasCleaningGroup(user) || truthy(objectAccess.enabled);

  return {
    enabled,
    canPerformRounds: enabled && objectAccess.canPerformRounds !== false,
    canReceiveComplaints: enabled && objectAccess.canReceiveComplaints !== false,
    canCloseComplaints: enabled && objectAccess.canCloseComplaints !== false,
    canManageCleaningZones: hasPermission(user, "cleaning", "manage") || hasPermission(user, "settings", "manage") || truthy(objectAccess.canManageCleaningZones),
    canViewCleaningReports: hasPermission(user, "cleaning", "view") || hasPermission(user, "analytics", "view") || truthy(objectAccess.canViewCleaningReports),
    zoneIds: Array.isArray(objectAccess.zoneIds) ? [...new Set(objectAccess.zoneIds.map(cleanString).filter(Boolean))] : [],
    source: isLegacyCleanerRole(user)
      ? "legacy-role"
      : enabledByFlag || truthy(objectAccess.enabled)
        ? "cleaning-access"
        : hasCleaningGroup(user)
          ? "group"
          : "none"
  };
};

export const hasCleaningAccess = (user = {}) => normalizeCleaningAccess(user).enabled;

export const canPerformCleaning = (user = {}) => user.role === "admin" || normalizeCleaningAccess(user).canPerformRounds;

export const canReceiveCleaningComplaints = (user = {}) => user.role === "admin" || normalizeCleaningAccess(user).canReceiveComplaints;

export const canCloseCleaningComplaints = (user = {}) => user.role === "admin" || normalizeCleaningAccess(user).canCloseComplaints;

export const canManageCleaningZones = (user = {}) => user.role === "admin" || normalizeCleaningAccess(user).canManageCleaningZones;

export const canViewCleaningReports = (user = {}) => user.role === "admin" || normalizeCleaningAccess(user).canViewCleaningReports;
