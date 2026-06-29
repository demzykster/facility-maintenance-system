import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { sendJson, sendServerError } from "../httpErrors.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
};

const getHeader = (headers = {}, name) => {
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (direct) return Array.isArray(direct) ? direct[0] : direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match ? (Array.isArray(match[1]) ? match[1][0] : match[1]) : "";
};

const bearerToken = (req) => {
  const value = String(getHeader(req.headers, "authorization") || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
};

const text = (value, max = 160) => String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

const safePath = (value = "") => text(value, 220).split("?")[0].split("#")[0];

const safeKey = (key = "") => {
  const raw = text(key, 120);
  if (!raw) return "";
  const [prefix, rest] = raw.split(":");
  if (!rest) return raw;
  return `${prefix}:${String(rest).slice(0, 18)}`;
};

const safeMetadata = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return {
    error: text(value.error, 120),
    actorRole: text(value.actorRole, 40),
    actorId: text(value.actorId, 80),
    online: typeof value.online === "boolean" ? value.online : null,
    visibilityState: text(value.visibilityState, 24),
    focused: typeof value.focused === "boolean" ? value.focused : null,
    viewport: text(value.viewport, 32),
    errorId: text(value.errorId, 40)
  };
};

async function authorize(req, env, fetchImpl, sessionClient) {
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
    return { ok: true, user: session.user };
  } catch {
    return { ok: false, status: 401, error: "supabase_session_failed" };
  }
}

export function createClientErrorsHandler({ auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendAuditDriver = auditDriver
    || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function clientErrorsHandler(req, res) {
    if (String(req.method || "GET").toUpperCase() !== "POST") {
      res.setHeader("allow", "POST");
      return sendJson(res, 405, { error: "method_not_allowed" });
    }

    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });
    if (!backendAuditDriver) return sendJson(res, 503, { error: "audit_backend_not_configured" });

    try {
      const body = await readBody(req);
      await backendAuditDriver.write(normalizeAuditEvent({
        at: Date.now(),
        actorId: auth.user.id,
        actorName: auth.user.name,
        actorRole: auth.user.role,
        entityType: AUDIT_ENTITY_TYPES.system,
        entityId: "client-error",
        action: AUDIT_ACTIONS.clientError,
        summary: text(body.message || body.kind || "Client error", 180),
        metadata: {
          kind: text(body.kind, 80),
          operation: text(body.operation, 32),
          key: safeKey(body.key),
          shared: body.shared === true,
          path: safePath(body.path),
          userAgent: text(body.userAgent, 180),
          metadata: safeMetadata(body.metadata)
        }
      }));
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendServerError(req, res, error, { code: "client_error_log_failed", route: "/api/client-errors" });
    }
  };
}

export default createClientErrorsHandler();
