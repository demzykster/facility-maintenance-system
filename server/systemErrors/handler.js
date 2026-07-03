import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { sendJson, sendServerError } from "../httpErrors.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { bearerToken } from "../session/authCookie.js";

const text = (value, max = 160) => String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

const canViewSystemErrors = (user = {}) => (
  user.role === "admin" || ["manage", "full"].includes(user.permissions?.settings)
);

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
    if (!canViewSystemErrors(session.user)) return { ok: false, status: 403, error: "system_errors_forbidden" };
    return { ok: true, user: session.user };
  } catch {
    return { ok: false, status: 401, error: "supabase_session_failed" };
  }
}

const normalizeSystemError = (event = {}) => ({
  id: text(event.id, 120),
  at: Number(event.at || Date.now()),
  actorName: text(event.actorName, 80),
  actorRole: text(event.actorRole, 40),
  summary: text(event.summary, 180),
  kind: text(event.metadata?.kind, 80),
  operation: text(event.metadata?.operation, 32),
  key: text(event.metadata?.key, 80),
  path: text(event.metadata?.path, 220),
  error: text(event.metadata?.metadata?.error || event.metadata?.error, 120),
  online: event.metadata?.metadata?.online,
  visibilityState: text(event.metadata?.metadata?.visibilityState, 24),
  focused: event.metadata?.metadata?.focused,
  viewport: text(event.metadata?.metadata?.viewport, 32),
  errorId: text(event.metadata?.metadata?.errorId, 40)
});

export function createSystemErrorsHandler({ auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendAuditDriver = auditDriver
    || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function systemErrorsHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "GET") {
      res.setHeader("allow", "GET");
      return sendJson(res, 405, { error: "method_not_allowed" });
    }

    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });
    if (!backendAuditDriver?.listClientErrors) return sendJson(res, 503, { error: "audit_backend_not_configured" });

    try {
      const limit = Number(new URL(req.url || "/api/system-errors", "https://cmms.local").searchParams.get("limit") || 50);
      const events = await backendAuditDriver.listClientErrors({ limit });
      return sendJson(res, 200, { ok: true, errors: events.map(normalizeSystemError) });
    } catch (error) {
      return sendServerError(req, res, error, { code: "system_errors_list_failed", route: "/api/system-errors" });
    }
  };
}

export default createSystemErrorsHandler();
