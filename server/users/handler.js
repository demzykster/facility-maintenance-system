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

export function appUserPatchFromUserRecord(user = {}) {
  return {
    name: cleanString(user.name) || null,
    role: cleanString(user.role) || "user",
    active: user.active !== false,
    email: cleanEmail(user.email) || null,
    phone: cleanString(user.phone) || null,
    department: cleanString(user.dept || user.department) || null,
    departments: Array.isArray(user.depts) ? user.depts.map(cleanString).filter(Boolean) : (user.dept ? [cleanString(user.dept)] : []),
    permissions: user.perms || user.permissions || {},
    manager_zones: Array.isArray(user.mgrZones) ? user.mgrZones.map(cleanString).filter(Boolean) : [],
    tech_scope: cleanString(user.techScope) || null,
    supplier: cleanString(user.supplier) || null
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
    supplier: appUser.supplier || legacy.supplier || "",
    mustChangePassword: appUser.mustChangePassword
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
    if (!backendDriver) return json(res, 503, { error: "users_backend_not_configured" });

    try {
      const method = String(req.method || "GET").toUpperCase();
      if (!["GET", "POST", "DELETE"].includes(method)) {
        res.setHeader("allow", "GET, POST, DELETE");
        return json(res, 405, { error: "method_not_allowed" });
      }

      if (method === "GET") {
        if (typeof backendDriver.get !== "function" || typeof backendDriver.listValues !== "function") return json(res, 503, { error: "users_read_not_configured" });
        const id = String(req.query?.id || "").trim();
        const canReadProfiles = typeof backendProfileClient?.getAppUserProfileById === "function" && typeof backendProfileClient?.listAppUserProfiles === "function";
        if (id) {
          const key = `user:${id}`;
          const permissionError = kvReadPermissionError(auth.user, key);
          if (permissionError) return json(res, 403, { error: permissionError });
          if (canReadProfiles) {
            const profile = await backendProfileClient.getAppUserProfileById(id);
            if (profile) {
              const legacy = await legacyUserForProfile(backendDriver, profile);
              const user = userRecordFromAppUserProfile(profile, legacy);
              return json(res, 200, { ok: true, user: publicUserForSession(appUserRecordKey(user), user, auth.user), source: "app_users" });
            }
          }
          const value = await backendDriver.get(key, true);
          if (!value) return json(res, 404, { error: "user_not_found" });
          return json(res, 200, { ok: true, user: publicUserForSession(key, JSON.parse(value), auth.user), source: "kv" });
        }
        if (canReadProfiles) {
          const profiles = await backendProfileClient.listAppUserProfiles();
          const usersById = new Map();
          for (const profile of profiles) {
            const legacy = await legacyUserForProfile(backendDriver, profile);
            const user = userRecordFromAppUserProfile(profile, legacy);
            usersById.set(user.id, publicUserForSession(appUserRecordKey(user), user, auth.user));
          }
          const legacyRecords = (await backendDriver.listValues("user:", true))
            .map(parseStoredUser)
            .filter(Boolean)
            .filter((record) => !kvReadPermissionError(auth.user, record.key));
          for (const record of legacyRecords) {
            const user = record.user || {};
            if (user.authUserId || usersById.has(user.id)) continue;
            usersById.set(user.id, publicUserForSession(record.key, user, auth.user));
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
        if (typeof backendDriver.delete !== "function") return json(res, 503, { error: "users_delete_not_configured" });
        await backendDriver.delete(key, true);
        await writeAuditEvent(backendAuditDriver, userDeleteAuditEvent(id, auth.user));
        return json(res, 200, { ok: true, user: { id } });
      }

      const user = body?.user || body;
      const id = String(user?.id || "").trim();
      if (!id) return json(res, 400, { error: "user_id_required" });
      const key = `user:${id}`;
      const permissionError = kvWritePermissionError(auth.user, key);
      if (permissionError) return json(res, 403, { error: permissionError });
      if (typeof backendDriver.set !== "function") return json(res, 503, { error: "users_write_not_configured" });
      if (user.authUserId) {
        if (!backendProfileClient) return json(res, 503, { error: "users_profile_backend_not_configured" });
        const patch = appUserPatchFromUserRecord(user);
        if (patch.email) await backendProfileClient.updateAuthEmail(user.authUserId, patch.email);
        await backendProfileClient.updateAppUserProfile(user.authUserId, patch);
      }
      await backendDriver.set(key, JSON.stringify(user), true);
      await writeAuditEvent(backendAuditDriver, userUpsertAuditEvent(user, auth.user));
      return json(res, 200, { ok: true, user: redactUserSecrets(user) });
    } catch (error) {
      if (error instanceof SyntaxError) return json(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "users_api_error", route: "/api/users" });
    }
  };
}

export default createUsersApiHandler();
