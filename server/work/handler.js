import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { normalizeMaintenanceMeetingRecord, normalizeMaintenanceTaskRecord } from "../../src/workRecordModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { kvWritePermissionError } from "../kv/permissionPolicy.js";
import { bearerToken } from "../session/authCookie.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { createSupabaseWorkDriversFromEnv } from "./supabaseWorkDriver.js";

const ACTIVE_ROLES = Object.freeze(["admin", "executive", "user", "tech", "worker", "cleaner"]);

const RESOURCE_CONFIG = Object.freeze({
  tasks: {
    singular: "task",
    plural: "tasks",
    kvPrefix: "mtask:",
    idError: "maintenance_task_id_required",
    notFoundError: "maintenance_task_not_found",
    backendError: "maintenance_tasks_backend_not_configured",
    readError: "maintenance_tasks_read_not_configured",
    deleteError: "maintenance_tasks_delete_not_configured",
    source: "api/work:tasks",
    entityType: AUDIT_ENTITY_TYPES.task,
    normalize: normalizeMaintenanceTaskRecord,
    summaryName: "Maintenance task",
    after: (record) => ({ title: record.title, status: record.status, sourceModule: record.sourceModule, meetingId: record.meetingId })
  },
  meetings: {
    singular: "meeting",
    plural: "meetings",
    kvPrefix: "mmeet:",
    idError: "maintenance_meeting_id_required",
    notFoundError: "maintenance_meeting_not_found",
    backendError: "maintenance_meetings_backend_not_configured",
    readError: "maintenance_meetings_read_not_configured",
    deleteError: "maintenance_meetings_delete_not_configured",
    source: "api/work:meetings",
    entityType: AUDIT_ENTITY_TYPES.meeting,
    normalize: normalizeMaintenanceMeetingRecord,
    summaryName: "Maintenance meeting",
    after: (record) => ({ title: record.title, status: record.status, meetingAt: record.meetingAt })
  }
});

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

const canReadWorkRecords = (user = {}) => ACTIVE_ROLES.includes(user.role);

const writeAuditEvent = async (auditDriver, event) => {
  if (!auditDriver || !event) return;
  if (typeof auditDriver.write === "function") return auditDriver.write(event);
};

const upsertAuditEvent = (config, record, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: config.entityType,
  entityId: record.id,
  action: AUDIT_ACTIONS.update,
  summary: `${config.summaryName} upserted through normalized API: ${record.id}`,
  after: config.after(record),
  metadata: { source: config.source, sourceKvKey: record.sourceKvKey }
});

const deleteAuditEvent = (config, id, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: config.entityType,
  entityId: id,
  action: AUDIT_ACTIONS.delete,
  summary: `${config.summaryName} deleted through normalized API: ${id}`,
  before: { id },
  metadata: { source: config.source, sourceKvKey: `${config.kvPrefix}${id}` }
});

const resourceFromRequest = (req, body = {}) => {
  const value = String(req.query?.resource || body?.resource || "").trim();
  return RESOURCE_CONFIG[value] ? value : "";
};

export function createWorkApiHandler({ drivers = null, auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDrivers = drivers || createSupabaseWorkDriversFromEnv(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function workApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    try {
      const method = String(req.method || "GET").toUpperCase();
      if (!["GET", "POST", "DELETE"].includes(method)) {
        res.setHeader("allow", "GET, POST, DELETE");
        return json(res, 405, { error: "method_not_allowed" });
      }
      const body = method === "GET" ? {} : await readBody(req);
      const resource = resourceFromRequest(req, body);
      if (!resource) return json(res, 400, { error: "work_resource_required" });
      const config = RESOURCE_CONFIG[resource];
      const backendDriver = backendDrivers?.[resource];
      if (!backendDriver) return json(res, 503, { error: config.backendError });

      if (method === "GET") {
        if (!canReadWorkRecords(auth.user)) return json(res, 403, { error: "permission_required:work:read" });
        if (typeof backendDriver.get !== "function" || typeof backendDriver.list !== "function") return json(res, 503, { error: config.readError });
        const id = String(req.query?.id || "").trim();
        if (id) {
          const record = await backendDriver.get(id);
          if (!record) return json(res, 404, { error: config.notFoundError });
          return json(res, 200, { ok: true, [config.singular]: record });
        }
        const records = await backendDriver.list({ limit: req.query?.limit });
        return json(res, 200, { ok: true, [config.plural]: records });
      }

      if (method === "DELETE") {
        const id = String(req.query?.id || body?.id || body?.[config.singular]?.id || "").trim();
        if (!id) return json(res, 400, { error: config.idError });
        const permissionError = kvWritePermissionError(auth.user, `${config.kvPrefix}${id}`);
        if (permissionError) return json(res, 403, { error: permissionError });
        if (typeof backendDriver.delete !== "function") return json(res, 503, { error: config.deleteError });
        await backendDriver.delete(id);
        await writeAuditEvent(backendAuditDriver, deleteAuditEvent(config, id, auth.user));
        return json(res, 200, { ok: true, [config.singular]: { id } });
      }

      const record = config.normalize(body?.[config.singular] || body);
      const permissionError = kvWritePermissionError(auth.user, `${config.kvPrefix}${record.id}`);
      if (permissionError) return json(res, 403, { error: permissionError });
      await backendDriver.upsert(record.legacyPayload);
      await writeAuditEvent(backendAuditDriver, upsertAuditEvent(config, record, auth.user));
      return json(res, 200, { ok: true, [config.singular]: { id: record.id, sourceKvKey: record.sourceKvKey } });
    } catch (error) {
      if (error?.message === "maintenance_task_id_required") return json(res, 400, { error: "maintenance_task_id_required" });
      if (error?.message === "maintenance_meeting_id_required") return json(res, 400, { error: "maintenance_meeting_id_required" });
      if (error instanceof SyntaxError) return json(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "work_api_error", route: "/api/work" });
    }
  };
}

export default createWorkApiHandler();
