import { PERM_LEVELS, USER_PERMISSION_MODULES } from "./permissionModel.js";

export const SUPABASE_APP_USER_TABLE = "app_users";

export const SUPABASE_APP_USER_ROLES = Object.freeze(["admin", "executive", "user", "tech", "worker", "cleaner"]);

export const SUPABASE_PERMISSION_LEVEL_RANK = Object.freeze(
  Object.fromEntries(PERM_LEVELS.map((level, index) => [level, index]))
);

export const SUPABASE_PERMISSION_MODULE_KEYS = Object.freeze(
  USER_PERMISSION_MODULES.map((module) => module.mod)
);

export function supabasePermissionRank(level) {
  return SUPABASE_PERMISSION_LEVEL_RANK[level] ?? 0;
}

export function normalizeSupabaseAppUserProfile(profile = {}) {
  const role = SUPABASE_APP_USER_ROLES.includes(profile.role) ? profile.role : "user";
  const email = String(profile.email || "").trim().toLowerCase();
  const numberOrNull = (value) => value === null || value === undefined || value === "" ? null : Number(value);
  return {
    id: profile.id || null,
    authUserId: profile.authUserId || profile.auth_user_id || null,
    role,
    name: String(profile.name || "").trim(),
    position: profile.position || profile.jobTitle || profile.job_title || "",
    email: email || null,
    phone: String(profile.phone || "").trim(),
    workerNo: profile.workerNo || profile.worker_no || null,
    department: profile.department || profile.dept || null,
    departments: Array.isArray(profile.departments) ? profile.departments : [],
    mgrZones: Array.isArray(profile.mgrZones) ? profile.mgrZones : (Array.isArray(profile.manager_zones) ? profile.manager_zones : []),
    techScope: profile.techScope || profile.tech_scope || "",
    techCats: Array.isArray(profile.techCats) ? profile.techCats : (Array.isArray(profile.tech_cats) ? profile.tech_cats : []),
    supplier: profile.supplier || "",
    shift: profile.shift || "",
    shiftStart: profile.shiftStart || profile.shift_start || "",
    shiftEnd: profile.shiftEnd || profile.shift_end || "",
    lateTolerance: numberOrNull(profile.lateTolerance ?? profile.late_tolerance),
    earlyTolerance: numberOrNull(profile.earlyTolerance ?? profile.early_tolerance),
    cleaningAccess: profile.cleaningAccess ?? profile.cleaning_access ?? false,
    notificationPrefs: profile.notificationPrefs || profile.notification_prefs || {},
    employmentType: profile.employmentType || profile.employment_type || "",
    contractorName: profile.contractorName || profile.contractor_name || "",
    reportsTo: profile.reportsTo || profile.reports_to || "",
    status: profile.status || "",
    exitAt: profile.exitAt || (profile.exit_at ? Date.parse(profile.exit_at) : null),
    ppeResetAt: profile.ppeResetAt || (profile.ppe_reset_at ? Date.parse(profile.ppe_reset_at) : null),
    permissions: profile.permissions || profile.perms || {},
    active: profile.active !== false,
    mustChangePassword: profile.mustChangePassword === true || profile.must_change_password === true,
    loginState: profile.loginState || profile.login_state || "pending_setup",
    pinHash: profile.pinHash || profile.pin_hash || "",
    pinUpdatedAt: profile.pinUpdatedAt || (profile.pin_updated_at ? Date.parse(profile.pin_updated_at) : null)
  };
}
