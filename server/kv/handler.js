import { createUpstashKvDriverFromEnv } from "./upstashDriver.js";
import { createSupabaseKvDriverFromEnv } from "./supabaseDriver.js";
import { kvReadValueForSession, kvWritePermissionError, kvWritePermissionForKey, sensitiveKvWriteAuditEvent } from "./permissionPolicy.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { sendServerError } from "../httpErrors.js";
import { ticketStatusAuditEvent } from "../../src/auditEventModel.js";

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
};

const parseBool = (value) => value === true || value === "1" || value === "true";

const getHeader = (headers = {}, name) => {
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (direct) return direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match ? match[1] : "";
};

const bearerToken = (req) => {
  const value = String(getHeader(req.headers, "authorization") || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
};

function isTokenAuthorized(req, env) {
  if (env.CMMS_KV_ALLOW_UNAUTHENTICATED === "true") return true;
  const token = env.CMMS_KV_BEARER_TOKEN;
  if (!token) return false;
  return bearerToken(req) === token;
}

async function authorize(req, env, fetchImpl, sessionClient) {
  if (env.CMMS_KV_AUTH === "supabase") {
    const token = bearerToken(req);
    if (!token) return { ok: false, status: 401, error: "supabase_access_token_required" };
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

  return isTokenAuthorized(req, env)
    ? { ok: true }
    : { ok: false, status: 503, error: "storage_auth_not_configured" };
}

const writeAuditEvent = async (auditDriver, event) => {
  if (!auditDriver || !event) return;
  if (typeof auditDriver.write === "function") return auditDriver.write(event);
  if (typeof auditDriver.set === "function") return auditDriver.set(event);
};

const parseStoredJson = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const ticketStatusEventFromKv = (key, beforeValue, afterValue, actor) => {
  if (!String(key || "").startsWith("ticket:")) return null;
  const before = parseStoredJson(beforeValue);
  const after = parseStoredJson(afterValue);
  const previousStatus = String(before?.status || "");
  const nextStatus = String(after?.status || "");
  if (!previousStatus || !nextStatus || previousStatus === nextStatus) return null;
  return ticketStatusAuditEvent({ ...after, id: after.id || String(key).slice("ticket:".length) }, previousStatus, nextStatus, actor);
};

export function createKvApiHandler({ driver = null, auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDriver = driver
    || (env.CMMS_KV_DRIVER === "upstash" ? createUpstashKvDriverFromEnv(env, fetchImpl) : null)
    || (env.CMMS_KV_DRIVER === "supabase" ? createSupabaseKvDriverFromEnv(env, fetchImpl) : null);
  const backendAuditDriver = auditDriver
    || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function kvApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    if (!backendDriver) {
      return json(res, 503, { error: "storage_backend_not_configured" });
    }

    try {
      const method = String(req.method || "GET").toUpperCase();
      const query = req.query || {};
      const key = Array.isArray(query.key) ? query.key.join("/") : query.key;
      const shared = parseBool(query.shared);

      if (!key && method === "GET") {
        const prefix = String(query.prefix || "");
        if (parseBool(query.includeValues)) {
          const records = typeof backendDriver.listValues === "function"
            ? await backendDriver.listValues(prefix, shared)
            : await Promise.all((await backendDriver.list(prefix, shared)).map(async (recordKey) => ({
              key: recordKey,
              value: await backendDriver.get(recordKey, shared)
            })));
          const readable = records
            .map((record) => ({
              key: record.key,
              value: kvReadValueForSession({
                key: record.key,
                value: record.value,
                session: auth.user
              })
            }))
            .filter((record) => record.key && record.value !== null && record.value !== undefined);
          return json(res, 200, { records: readable });
        }
        const keys = await backendDriver.list(prefix, shared);
        return json(res, 200, { keys });
      }
      if (!key) return json(res, 400, { error: "key_required" });

      if ((method === "PUT" || method === "DELETE") && auth.user) {
        const permissionError = kvWritePermissionError(auth.user, key);
        if (permissionError) return json(res, 403, { error: permissionError });
      }

      if (method === "GET") {
        const value = kvReadValueForSession({
          key,
          value: await backendDriver.get(key, shared),
          session: auth.user
        });
        return json(res, 200, value === null || value === undefined ? null : { value });
      }
      if (method === "PUT") {
        const body = await readBody(req);
        const value = body?.value ?? "";
        const writeShared = parseBool(body?.shared ?? shared);
        const shouldAudit = backendAuditDriver && kvWritePermissionForKey(key);
        const shouldAuditTicketStatus = backendAuditDriver && String(key).startsWith("ticket:");
        const before = (shouldAudit || shouldAuditTicketStatus) ? await backendDriver.get?.(key, writeShared) : null;
        await backendDriver.set(key, value, writeShared);
        await writeAuditEvent(backendAuditDriver, shouldAudit && sensitiveKvWriteAuditEvent({
          key,
          method,
          actor: auth.user,
          before,
          after: value,
          shared: writeShared
        }));
        await writeAuditEvent(backendAuditDriver, ticketStatusEventFromKv(key, before, value, auth.user));
        return json(res, 200, { ok: true });
      }
      if (method === "DELETE") {
        const shouldAudit = backendAuditDriver && kvWritePermissionForKey(key);
        const before = shouldAudit ? await backendDriver.get?.(key, shared) : null;
        await backendDriver.delete(key, shared);
        await writeAuditEvent(backendAuditDriver, shouldAudit && sensitiveKvWriteAuditEvent({
          key,
          method,
          actor: auth.user,
          before,
          shared
        }));
        return json(res, 200, { ok: true });
      }

      res.setHeader("allow", key ? "GET, PUT, DELETE" : "GET");
      return json(res, 405, { error: "method_not_allowed" });
    } catch (error) {
      return sendServerError(req, res, error, { code: "storage_api_error", route: "/api/kv" });
    }
  };
}

export default createKvApiHandler();
