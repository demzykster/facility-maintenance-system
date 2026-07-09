import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { kvReadPermissionError, kvReadValueForSession, kvWritePermissionError, redactUserSecrets } from "../kv/permissionPolicy.js";
import { createSupabaseKvDriverFromEnv } from "../kv/supabaseDriver.js";
import { createUpstashKvDriverFromEnv } from "../kv/upstashDriver.js";
import { bearerToken } from "../session/authCookie.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";

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

const publicUserForSession = (key, user, session) => {
  const value = kvReadValueForSession({ key, value: JSON.stringify(user), session });
  try {
    return JSON.parse(value);
  } catch {
    return user;
  }
};

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

export function createUsersApiHandler({ driver = null, auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDriver = driver || createDefaultDriver(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

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
        if (id) {
          const key = `user:${id}`;
          const permissionError = kvReadPermissionError(auth.user, key);
          if (permissionError) return json(res, 403, { error: permissionError });
          const value = await backendDriver.get(key, true);
          if (!value) return json(res, 404, { error: "user_not_found" });
          return json(res, 200, { ok: true, user: publicUserForSession(key, JSON.parse(value), auth.user) });
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
