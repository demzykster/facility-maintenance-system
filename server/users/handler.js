import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { kvReadPermissionError, kvReadValueForSession, kvWritePermissionError, redactUserSecrets } from "../kv/permissionPolicy.js";
import { createSupabaseKvDriverFromEnv } from "../kv/supabaseDriver.js";
import { createUpstashKvDriverFromEnv } from "../kv/upstashDriver.js";
import { bearerToken } from "../session/authCookie.js";
import { createSupabaseProfileUpdateClient } from "../session/profileHandler.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { normalizeSupabaseAppUserProfile } from "../../src/supabaseProfileModel.js";
import { canUseScopedWorkerWrite } from "../../src/userScopeModel.js";

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req?.[Symbol.asyncIterator] !== "function") return {};
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
};

const parseStoredUser = (record) => {
  if (!record?.key || typeof record.value !== "string") return null;
  try {
    return { key: record.key, user: JSON.parse(record.value) };
  } catch {
    return null;
  }
};

const cleanString = (value) => String(value || "").trim();
const cleanEmail = (value) => cleanString(value).toLowerCase();
const cleanDigits = (value) => cleanString(value).replace(/\D/g, "");
const cleanStringArray = (values = []) =>
  [...new Set((Array.isArray(values) ? values : []).map(cleanString).filter(Boolean))];
const cleanObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const numberOrNull = (value) => value === null || value === undefined || value === "" ? null : Math.max(0, Number(value) || 0);
const timestampOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const ts = Number(value);
  return Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : null;
};
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
const OPTIONAL_APP_USERS_PROFILE_FIELDS = new Set([
  "position",
  "tech_cats",
  "shift",
  "shift_start",
  "shift_end",
  "late_tolerance",
  "early_tolerance",
  "cleaning_access",
  "notification_prefs",
  "employment_type",
  "contractor_name",
  "reports_to",
  "status",
  "exit_at",
  "ppe_reset_at",
  "pin_hash",
  "pin_updated_at",
  "login_state"
]);

const supabaseMissingAppUsersColumn = (error) =>
  /PGRST204|schema cache|could not find .*column|column .* does not exist/i.test(String(error?.message || error || ""));

export function stripOptionalAppUsersProfileFields(patch = {}) {
  return Object.fromEntries(
    Object.entries(patch || {}).filter(([field]) => !OPTIONAL_APP_USERS_PROFILE_FIELDS.has(field))
  );
}

async function writeAppUserProfileWithSchemaFallback(operation, patch) {
  try {
    return await operation(patch);
  } catch (error) {
    if (!supabaseMissingAppUsersColumn(error)) throw error;
    const fallbackPatch = stripOptionalAppUsersProfileFields(patch);
    if (Object.keys(fallbackPatch).length === Object.keys(patch || {}).length) throw error;
    return operation(fallbackPatch);
  }
}

export function appUserPatchFromUserRecord(user = {}) {
  return {
    name: cleanString(user.name) || null,
    position: cleanString(user.position || user.jobTitle) || null,
    role: cleanString(user.role) || "user",
    active: user.active !== false,
    email: cleanEmail(user.email) || null,
    phone: cleanString(user.phone) || null,
    worker_no: (user.role === "worker" || user.role === "cleaner") ? (cleanString(user.workerNo) || null) : null,
    department: cleanString(user.dept || user.department) || null,
    departments: Array.isArray(user.depts) ? cleanStringArray(user.depts) : (user.dept ? [cleanString(user.dept)] : []),
    permissions: user.perms || user.permissions || {},
    manager_zones: cleanStringArray(user.mgrZones),
    tech_scope: cleanString(user.techScope) || null,
    tech_cats: cleanStringArray(user.techCats),
    supplier: cleanString(user.supplier) || null
  };
}

export function extendedAppUserPatchFromUserRecord(user = {}) {
  return {
    ...appUserPatchFromUserRecord(user),
    shift: cleanString(user.shift) || null,
    shift_start: cleanString(user.shiftStart) || null,
    shift_end: cleanString(user.shiftEnd) || null,
    late_tolerance: numberOrNull(user.lateTolerance),
    early_tolerance: numberOrNull(user.earlyTolerance),
    cleaning_access: user.cleaningAccess === undefined ? false : user.cleaningAccess,
    notification_prefs: cleanObject(user.notificationPrefs || user.notificationPreferences || user.notifyPrefs),
    employment_type: cleanString(user.employmentType) || null,
    contractor_name: cleanString(user.contractorName) || null,
    reports_to: cleanString(user.reportsTo) || null,
    status: cleanString(user.status) || null,
    exit_at: timestampOrNull(user.exitAt),
    ppe_reset_at: timestampOrNull(user.ppeResetAt)
  };
}

const publicUserForSession = (key, user, session) => {
  const value = kvReadValueForSession({ key, value: JSON.stringify(user), session });
  try {
    return JSON.parse(value);
  } catch {
    return user;
  }
};

export function userRecordFromAppUserProfile(profile = {}, legacy = {}) {
  const appUser = normalizeSupabaseAppUserProfile(profile);
  return {
    ...(legacy || {}),
    id: appUser.id || legacy.id || "",
    authUserId: appUser.authUserId || legacy.authUserId || "",
    appUserId: appUser.id || legacy.appUserId || "",
    name: appUser.name || legacy.name || "",
    position: appUser.position || legacy.position || legacy.jobTitle || "",
    role: appUser.role || legacy.role || "user",
    active: appUser.active,
    email: appUser.email || "",
    phone: appUser.phone || "",
    workerNo: appUser.workerNo || legacy.workerNo || "",
    dept: appUser.department || legacy.dept || "",
    depts: appUser.departments?.length ? appUser.departments : (Array.isArray(legacy.depts) ? legacy.depts : []),
    perms: appUser.permissions || legacy.perms || {},
    mgrZones: appUser.mgrZones || legacy.mgrZones || [],
    techScope: appUser.techScope || legacy.techScope || "",
    techCats: appUser.techCats?.length ? appUser.techCats : (Array.isArray(legacy.techCats) ? legacy.techCats : []),
    supplier: appUser.supplier || legacy.supplier || "",
    shift: appUser.shift || legacy.shift || "",
    shiftStart: appUser.shiftStart || legacy.shiftStart || "",
    shiftEnd: appUser.shiftEnd || legacy.shiftEnd || "",
    lateTolerance: appUser.lateTolerance ?? legacy.lateTolerance,
    earlyTolerance: appUser.earlyTolerance ?? legacy.earlyTolerance,
    cleaningAccess: appUser.cleaningAccess ?? legacy.cleaningAccess ?? legacy.cleaning ?? false,
    notificationPrefs: Object.keys(appUser.notificationPrefs || {}).length ? appUser.notificationPrefs : (legacy.notificationPrefs || legacy.notificationPreferences || legacy.notifyPrefs || {}),
    employmentType: appUser.employmentType || legacy.employmentType || "",
    contractorName: appUser.contractorName || legacy.contractorName || "",
    reportsTo: appUser.reportsTo || legacy.reportsTo || "",
    status: appUser.status || legacy.status || "",
    exitAt: appUser.exitAt ?? legacy.exitAt ?? null,
    ppeResetAt: appUser.ppeResetAt ?? legacy.ppeResetAt ?? null,
    mustChangePassword: appUser.mustChangePassword,
    loginState: appUser.loginState || legacy.loginState || "",
    loginConfigured: appUser.loginState === "active" || !!appUser.pinHash || legacy.loginConfigured === true
  };
}

const legacyUserKeyCandidates = (profile = {}) => {
  const appUser = normalizeSupabaseAppUserProfile(profile);
  return [
    appUser.id,
    appUser.authUserId,
    appUser.workerNo,
    appUser.email
  ].filter(Boolean).map((id) => `user:${id}`);
};

const legacyUserMatchesProfile = (profile = {}, legacy = {}) => {
  const appUser = normalizeSupabaseAppUserProfile(profile);
  if (appUser.id && appUser.id === legacy.id) return true;
  if (appUser.authUserId && appUser.authUserId === legacy.authUserId) return true;
  if (appUser.workerNo && cleanString(appUser.workerNo) === cleanString(legacy.workerNo)) return true;
  if (appUser.email && cleanEmail(appUser.email) === cleanEmail(legacy.email)) return true;
  if (appUser.phone && cleanDigits(appUser.phone) && cleanDigits(appUser.phone) === cleanDigits(legacy.phone)) return true;
  return false;
};

const legacyUserForProfile = async (driver, profile = {}) => {
  if (typeof driver?.get !== "function") return {};
  for (const key of legacyUserKeyCandidates(profile)) {
    const value = await driver.get(key, true);
    if (!value) continue;
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
};

const appUserRecordKey = (user = {}) => `user:${user.id}`;
const userLoginResetPatch = (user = {}) => {
  const role = cleanString(user.role);
  if (role === "worker" || role === "cleaner" || role === "tech") {
    return {
      pin_hash: null,
      pin_updated_at: null,
      login_state: "reset_required",
      must_change_password: false
    };
  }
  if (role === "admin" || role === "executive" || role === "user") {
    return {
      login_state: "reset_required",
      must_change_password: true
    };
  }
  return {};
};

const appUserCreateProfileFromUserRecord = (user = {}) => ({
  ...extendedAppUserPatchFromUserRecord(user),
  login_state: user.active === false || user.status === "archived" ? "disabled" : "pending_setup",
  must_change_password: false,
  login_metadata: {
    source: "api/users",
    client_user_id: cleanString(user.id)
  }
});

const createDefaultDriver = (env, fetchImpl) => {
  if (env.CMMS_KV_DRIVER === "upstash") return createUpstashKvDriverFromEnv(env, fetchImpl);
  if (env.CMMS_KV_DRIVER === "supabase") return createSupabaseKvDriverFromEnv(env, fetchImpl);
  return null;
};

async function authorize(req, env, fetchImpl, sessionClient) {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: "supabase_access_token_required" };

  const cmmsSecret = String(env.CMMS_SESSION_SECRET || "").trim();
  if (cmmsSecret) {
    const cmmsUser = verifyCmmsSessionToken(token, cmmsSecret);
    if (cmmsUser) return { ok: true, user: cmmsUser };
  }

  const client = sessionClient || createSupabaseSessionClient({
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    fetchImpl
  });
  if (!client) return { ok: false, status: 503, error: "supabase_session_not_configured" };

  try {
    const authUser = await client.getAuthUser(token);
    const profile = await client.getAppUserProfile(token, authUser?.id);
    const session = buildSessionPayload(authUser, profile);
    if (!session.ok) return { ok: false, status: session.error === "app_user_disabled" ? 403 : 401, error: session.error };
    if (session.user.mustChangePassword) return { ok: false, status: 403, error: "password_change_required" };
    return { ok: true, user: session.user };
  } catch {
    return { ok: false, status: 401, error: "supabase_session_failed" };
  }
}

const writeAuditEvent = async (auditDriver, event) => {
  if (!auditDriver || !event) return;
  if (typeof auditDriver.write === "function") return auditDriver.write(event);
};

const writeKvMirror = async (driver, key, value) => {
  if (typeof driver?.set !== "function") return false;
  await driver.set(key, value, true);
  return true;
};

const userKvMirrorRecord = (user = {}) => {
  const clean = { ...(user || {}) };
  delete clean.loginResetRequested;
  delete clean.loginConfigured;
  return clean;
};

const canUseScopedExistingWorkerWrite = (actor = {}, incomingUser = {}, existingProfile = null) => {
  if (!canUseScopedWorkerWrite(actor, incomingUser)) return false;
  if (!existingProfile) return true;
  const existingUser = userRecordFromAppUserProfile(existingProfile, {});
  return canUseScopedWorkerWrite(actor, existingUser);
};

const deleteKvMirror = async (driver, key) => {
  if (typeof driver?.delete !== "function") return false;
  await driver.delete(key, true);
  return true;
};

const userDeleteAuditEvent = (userId, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.user,
  entityId: userId,
  action: AUDIT_ACTIONS.delete,
  summary: `User deleted through user-management API: ${userId}`,
  before: { id: userId },
  metadata: { source: "api/users", sourceKvKey: `user:${userId}` }
});

const userUpsertAuditEvent = (user, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.user,
  entityId: user.id,
  action: AUDIT_ACTIONS.update,
  summary: `User upserted through user-management API: ${user.id}`,
  after: { id: user.id, role: user.role, active: user.active !== false },
  metadata: { source: "api/users", sourceKvKey: `user:${user.id}` }
});

export function createUsersApiHandler({ driver = null, auditDriver = null, profileClient = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDriver = driver || createDefaultDriver(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);
  const backendProfileClient = profileClient || createSupabaseProfileUpdateClient({
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    fetchImpl
  });

  return async function usersApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    try {
      const method = String(req.method || "GET").toUpperCase();
      if (!["GET", "POST", "DELETE"].includes(method)) {
        res.setHeader("allow", "GET, POST, DELETE");
        return json(res, 405, { error: "method_not_allowed" });
      }

      if (method === "GET") {
        if (!backendDriver && !backendProfileClient) return json(res, 503, { error: "users_backend_not_configured" });
        const id = String(req.query?.id || "").trim();
        const canReadProfiles = typeof backendProfileClient?.getAppUserProfileById === "function" && typeof backendProfileClient?.listAppUserProfiles === "function";
        if (id) {
          const key = `user:${id}`;
          const permissionError = kvReadPermissionError(auth.user, key);
          if (permissionError) return json(res, 403, { error: permissionError });
          if (canReadProfiles) {
            const profile = await backendProfileClient.getAppUserProfileById(id);
            if (profile) {
              const user = userRecordFromAppUserProfile(profile, {});
              return json(res, 200, { ok: true, user: publicUserForSession(appUserRecordKey(user), user, auth.user), source: "app_users" });
            }
            return json(res, 404, { error: "user_not_found" });
          }
          if (typeof backendDriver?.get !== "function") return json(res, 404, { error: "user_not_found" });
          const value = await backendDriver.get(key, true);
          if (!value) return json(res, 404, { error: "user_not_found" });
          return json(res, 200, { ok: true, user: publicUserForSession(key, JSON.parse(value), auth.user), source: "kv" });
        }
        if (canReadProfiles) {
          const profiles = await backendProfileClient.listAppUserProfiles();
          const usersById = new Map();
          for (const profile of profiles) {
            const user = userRecordFromAppUserProfile(profile, {});
            if (user.active === false) continue;
            usersById.set(user.id, publicUserForSession(appUserRecordKey(user), user, auth.user));
          }
          return json(res, 200, { ok: true, users: [...usersById.values()], source: "app_users" });
        }
        const users = (await backendDriver.listValues("user:", true))
          .map(parseStoredUser)
          .filter(Boolean)
          .filter((record) => !kvReadPermissionError(auth.user, record.key))
          .map((record) => publicUserForSession(record.key, record.user, auth.user));
        return json(res, 200, { ok: true, users });
      }

      const body = await readBody(req);
      if (method === "DELETE") {
        const id = String(req.query?.id || body?.id || body?.user?.id || "").trim();
        if (!id) return json(res, 400, { error: "user_id_required" });
        const key = `user:${id}`;
        const permissionError = kvWritePermissionError(auth.user, key);
        if (permissionError) return json(res, 403, { error: permissionError });
        let deactivatedProfile = false;
        if (typeof backendProfileClient?.getAppUserProfileById === "function" && typeof backendProfileClient?.updateAppUserProfile === "function") {
          const profile = await backendProfileClient.getAppUserProfileById(id);
          const appUser = profile ? normalizeSupabaseAppUserProfile(profile) : null;
          if (appUser?.authUserId) {
            await backendProfileClient.updateAppUserProfile(appUser.authUserId, { active: false });
            deactivatedProfile = true;
          }
        }
        if (!deactivatedProfile && typeof backendDriver?.delete !== "function") return json(res, 503, { error: "users_delete_not_configured" });
        if (!deactivatedProfile) await deleteKvMirror(backendDriver, key);
        await writeAuditEvent(backendAuditDriver, userDeleteAuditEvent(id, auth.user));
        return json(res, 200, { ok: true, user: { id } });
      }

      const user = body?.user || body;
      const id = String(user?.id || "").trim();
      if (!id) return json(res, 400, { error: "user_id_required" });
      const key = `user:${id}`;
      const permissionError = kvWritePermissionError(auth.user, key);
      if (permissionError && (!canUseScopedWorkerWrite(auth.user, user) || user.authUserId)) return json(res, 403, { error: permissionError });
      const loginResetRequested = user.loginResetRequested === true;
      let savedUser = user;
      let appUsersHandled = false;
      if (user.authUserId) {
        if (!backendProfileClient) return json(res, 503, { error: "users_profile_backend_not_configured" });
        const patch = {
          ...extendedAppUserPatchFromUserRecord(user),
          ...(loginResetRequested ? userLoginResetPatch(user) : {})
        };
        if (patch.email) await backendProfileClient.updateAuthEmail(user.authUserId, patch.email);
        const profile = await writeAppUserProfileWithSchemaFallback(
          (nextPatch) => backendProfileClient.updateAppUserProfile(user.authUserId, nextPatch),
          patch
        );
        savedUser = userRecordFromAppUserProfile(profile || {}, {});
        appUsersHandled = true;
      } else if (isUuid(id) && typeof backendProfileClient?.getAppUserProfileById === "function" && typeof backendProfileClient?.updateAppUserProfileById === "function") {
        const existingProfile = await backendProfileClient.getAppUserProfileById(id);
        if (permissionError && !canUseScopedExistingWorkerWrite(auth.user, user, existingProfile)) return json(res, 403, { error: permissionError });
        if (existingProfile) {
          const patch = {
            ...extendedAppUserPatchFromUserRecord(user),
            ...(loginResetRequested ? userLoginResetPatch(user) : {})
          };
          const profile = await writeAppUserProfileWithSchemaFallback(
            (nextPatch) => backendProfileClient.updateAppUserProfileById(id, nextPatch),
            patch
          );
          savedUser = userRecordFromAppUserProfile(profile || {}, {});
          appUsersHandled = true;
        } else if (typeof backendProfileClient?.createAppUserProfile === "function") {
          const patch = appUserCreateProfileFromUserRecord(user);
          const profile = await writeAppUserProfileWithSchemaFallback(
            (nextPatch) => backendProfileClient.createAppUserProfile(nextPatch),
            patch
          );
          savedUser = userRecordFromAppUserProfile(profile || {}, {});
          appUsersHandled = true;
        } else if (typeof backendDriver?.set !== "function") {
          return json(res, 503, { error: "users_legacy_backend_not_configured" });
        }
      } else if (typeof backendProfileClient?.createAppUserProfile === "function") {
        const patch = appUserCreateProfileFromUserRecord(user);
        const profile = await writeAppUserProfileWithSchemaFallback(
          (nextPatch) => backendProfileClient.createAppUserProfile(nextPatch),
          patch
        );
        savedUser = userRecordFromAppUserProfile(profile || {}, {});
        appUsersHandled = true;
      } else if (typeof backendDriver?.set !== "function") {
        return json(res, 503, { error: "users_legacy_backend_not_configured" });
      }
      if (!appUsersHandled) await writeKvMirror(backendDriver, key, JSON.stringify(userKvMirrorRecord(user)));
      await writeAuditEvent(backendAuditDriver, userUpsertAuditEvent(savedUser, auth.user));
      return json(res, 200, { ok: true, user: redactUserSecrets(savedUser) });
    } catch (error) {
      if (error instanceof SyntaxError) return json(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "users_api_error", route: "/api/users" });
    }
  };
}

export default createUsersApiHandler();
