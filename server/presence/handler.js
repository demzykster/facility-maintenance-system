import { normalizePresenceRecord } from "../../src/presenceRecordModel.js";
import { sendServerError } from "../httpErrors.js";
import { kvWritePermissionError } from "../kv/permissionPolicy.js";
import { bearerToken } from "../session/authCookie.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { createSupabasePresenceDriverFromEnv } from "./supabasePresenceDriver.js";

const ACTIVE_ROLES = Object.freeze(["admin", "user", "tech", "worker", "cleaner"]);

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

const canReadPresence = (user = {}) => ACTIVE_ROLES.includes(user.role);

export function createPresenceApiHandler({ driver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDriver = driver || createSupabasePresenceDriverFromEnv(env, fetchImpl);

  return async function presenceApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    try {
      const method = String(req.method || "GET").toUpperCase();
      if (!["GET", "POST", "DELETE"].includes(method)) {
        res.setHeader("allow", "GET, POST, DELETE");
        return json(res, 405, { error: "method_not_allowed" });
      }
      if (!backendDriver) return json(res, 503, { error: "presence_backend_not_configured" });

      if (method === "GET") {
        if (!canReadPresence(auth.user)) return json(res, 403, { error: "permission_required:presence:read" });
        if (typeof backendDriver.get !== "function" || typeof backendDriver.list !== "function") return json(res, 503, { error: "presence_read_not_configured" });
        const id = String(req.query?.id || "").trim();
        if (id) {
          const record = await backendDriver.get(id);
          if (!record) return json(res, 404, { error: "presence_not_found" });
          return json(res, 200, { ok: true, presence: record });
        }
        const presence = await backendDriver.list({ limit: req.query?.limit });
        return json(res, 200, { ok: true, presence });
      }

      const body = await readBody(req);
      const id = String(req.query?.id || body?.id || body?.presence?.id || "").trim();
      if (!id) return json(res, 400, { error: "presence_id_required" });
      const permissionError = kvWritePermissionError(auth.user, `presence:${id}`);
      if (permissionError) return json(res, 403, { error: permissionError });

      if (method === "DELETE") {
        if (typeof backendDriver.delete !== "function") return json(res, 503, { error: "presence_delete_not_configured" });
        await backendDriver.delete(id);
        return json(res, 200, { ok: true, presence: { id } });
      }

      const record = normalizePresenceRecord(body?.presence || body);
      await backendDriver.upsert(record.legacyPayload);
      return json(res, 200, { ok: true, presence: { id: record.id, sourceKvKey: record.sourceKvKey } });
    } catch (error) {
      if (error?.message === "presence_id_required") return json(res, 400, { error: "presence_id_required" });
      if (error instanceof SyntaxError) return json(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "presence_api_error", route: "/api/presence" });
    }
  };
}

export default createPresenceApiHandler();
