import { PERM_LEVELS, USER_PERMISSION_MODULES } from "./permissionModel.js";

export const SUPABASE_APP_USER_TABLE = "app_users";

export const SUPABASE_APP_USER_ROLES = Object.freeze(["admin", "user", "tech", "worker", "cleaner"]);

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
  return {
    id: profile.id || null,
    authUserId: profile.authUserId || profile.auth_user_id || null,
    role,
    name: String(profile.name || "").trim(),
    email: email || null,
    phone: String(profile.phone || "").trim(),
    workerNo: profile.workerNo || profile.worker_no || null,
    department: profile.department || profile.dept || null,
    departments: Array.isArray(profile.departments) ? profile.departments : [],
    mgrZones: Array.isArray(profile.mgrZones) ? profile.mgrZones : (Array.isArray(profile.manager_zones) ? profile.manager_zones : []),
    techScope: profile.techScope || profile.tech_scope || "",
    supplier: profile.supplier || "",
    permissions: profile.permissions || profile.perms || {},
    active: profile.active !== false,
    mustChangePassword: profile.mustChangePassword === true || profile.must_change_password === true
  };
}
