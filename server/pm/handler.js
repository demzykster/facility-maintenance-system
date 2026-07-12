import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { normalizePmRecord } from "../../src/pmRecordModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { bearerToken } from "../session/authCookie.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { kvWritePermissionError } from "../kv/permissionPolicy.js";
import { createSupabasePmDriverFromEnv } from "./supabasePmDriver.js";

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

const writeAuditEvent = async (auditDriver, event) => {
  if (!auditDriver || !event) return;
  if (typeof auditDriver.write === "function") return auditDriver.write(event);
};

const pmUpsertAuditEvent = (task, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.fleet,
  entityId: task.id,
  action: AUDIT_ACTIONS.update,
  summary: `Periodic maintenance task upserted through normalized API: ${task.id}`,
  after: { fleetUnitId: task.fleetUnitId, title: task.title, frequency: task.frequency, nextDue: task.nextDue },
  metadata: { source: "api/pm", sourceKvKey: task.sourceKvKey }
});

const pmDeleteAuditEvent = (taskId, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.fleet,
  entityId: taskId,
  action: AUDIT_ACTIONS.delete,
  summary: `Periodic maintenance task deleted through normalized API: ${taskId}`,
  before: { id: taskId },
  metadata: { source: "api/pm", sourceKvKey: `pm:${taskId}` }
});

const canReadPm = (user = {}) => ["admin", "executive", "user", "tech"].includes(user?.role);

export function createPmApiHandler({ driver = null, auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDriver = driver || createSupabasePmDriverFromEnv(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function pmApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    if (!backendDriver) return json(res, 503, { error: "pm_backend_not_configured" });

    try {
      const method = String(req.method || "GET").toUpperCase();
      if (!["GET", "POST", "DELETE"].includes(method)) {
        res.setHeader("allow", "GET, POST, DELETE");
        return json(res, 405, { error: "method_not_allowed" });
      }

      if (method === "GET") {
        if (!canReadPm(auth.user)) return json(res, 403, { error: "permission_required:pm:view" });
        if (typeof backendDriver.get !== "function" || typeof backendDriver.list !== "function") return json(res, 503, { error: "pm_read_not_configured" });
        const id = String(req.query?.id || "").trim();
        if (id) {
          const task = await backendDriver.get(id);
          if (!task) return json(res, 404, { error: "pm_task_not_found" });
          return json(res, 200, { ok: true, task });
        }
        const tasks = await backendDriver.list({ limit: req.query?.limit });
        return json(res, 200, { ok: true, tasks });
      }

      const body = await readBody(req);
      if (method === "DELETE") {
        const id = String(req.query?.id || body?.id || body?.task?.id || "").trim();
        if (!id) return json(res, 400, { error: "pm_id_required" });
        const permissionError = kvWritePermissionError(auth.user, `pm:${id}`);
        if (permissionError) return json(res, 403, { error: permissionError });
        if (typeof backendDriver.delete !== "function") return json(res, 503, { error: "pm_delete_not_configured" });
        await backendDriver.delete(id);
        await writeAuditEvent(backendAuditDriver, pmDeleteAuditEvent(id, auth.user));
        return json(res, 200, { ok: true, task: { id } });
      }

      const task = normalizePmRecord(body?.task || body);
      const permissionError = kvWritePermissionError(auth.user, `pm:${task.id}`);
      if (permissionError) return json(res, 403, { error: permissionError });

      await backendDriver.upsert(task.legacyPayload);
      await writeAuditEvent(backendAuditDriver, pmUpsertAuditEvent(task, auth.user));
      return json(res, 200, { ok: true, task: { id: task.id, sourceKvKey: task.sourceKvKey } });
    } catch (error) {
      if (error?.message === "pm_id_required") return json(res, 400, { error: "pm_id_required" });
      return sendServerError(req, res, error, { code: "pm_api_error", route: "/api/pm" });
    }
  };
}

export default createPmApiHandler();
