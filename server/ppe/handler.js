import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { canRequest, canView } from "../../src/permissionModel.js";
import {
  normalizePpeItemRecord,
  normalizePpeMovementRecord,
  normalizePpeNormRecord,
  normalizePpeOrderRecord,
  normalizePpeRequestRecord
} from "../../src/ppeRecordModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { kvWritePermissionError } from "../kv/permissionPolicy.js";
import { bearerToken } from "../session/authCookie.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { createSupabasePpeDriversFromEnv } from "./supabasePpeDriver.js";

const RESOURCE_CONFIG = Object.freeze({
  movements: {
    singular: "movement",
    plural: "movements",
    kvPrefix: "ppe:",
    idError: "ppe_movement_id_required",
    notFoundError: "ppe_movement_not_found",
    backendError: "ppe_movements_backend_not_configured",
    readError: "ppe_movements_read_not_configured",
    deleteError: "ppe_movements_delete_not_configured",
    source: "api/ppe:movements",
    normalize: normalizePpeMovementRecord,
    summaryName: "PPE movement",
    after: (record) => ({ workerId: record.workerId, itemId: record.itemId, size: record.size, qty: record.qty, movementType: record.movementType })
  },
  items: {
    singular: "item",
    plural: "items",
    kvPrefix: "ppeitem:",
    idError: "ppe_item_id_required",
    notFoundError: "ppe_item_not_found",
    backendError: "ppe_items_backend_not_configured",
    readError: "ppe_items_read_not_configured",
    deleteError: "ppe_items_delete_not_configured",
    source: "api/ppe:items",
    normalize: normalizePpeItemRecord,
    summaryName: "PPE item",
    after: (record) => ({ name: record.name, category: record.category, active: record.active })
  },
  norms: {
    singular: "norm",
    plural: "norms",
    kvPrefix: "ppenorm:",
    idError: "ppe_norm_id_required",
    notFoundError: "ppe_norm_not_found",
    backendError: "ppe_norms_backend_not_configured",
    readError: "ppe_norms_read_not_configured",
    deleteError: "ppe_norms_delete_not_configured",
    source: "api/ppe:norms",
    normalize: normalizePpeNormRecord,
    summaryName: "PPE norm",
    after: (record) => ({ dept: record.dept, itemId: record.itemId, active: record.active, policy: record.policy })
  },
  requests: {
    singular: "request",
    plural: "requests",
    kvPrefix: "ppereq:",
    idError: "ppe_request_id_required",
    notFoundError: "ppe_request_not_found",
    backendError: "ppe_requests_backend_not_configured",
    readError: "ppe_requests_read_not_configured",
    deleteError: "ppe_requests_delete_not_configured",
    source: "api/ppe:requests",
    normalize: normalizePpeRequestRecord,
    summaryName: "PPE request",
    after: (record) => ({ workerId: record.workerId, status: record.status, lines: record.lines.length })
  },
  orders: {
    singular: "order",
    plural: "orders",
    kvPrefix: "ppeorder:",
    idError: "ppe_order_id_required",
    notFoundError: "ppe_order_not_found",
    backendError: "ppe_orders_backend_not_configured",
    readError: "ppe_orders_read_not_configured",
    deleteError: "ppe_orders_delete_not_configured",
    source: "api/ppe:orders",
    normalize: normalizePpeOrderRecord,
    summaryName: "PPE order",
    after: (record) => ({ supplier: record.supplier, status: record.status, lines: record.lines.length })
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

const canReadPpeRecords = (user = {}) => (
  user.role === "admin"
  || user.role === "executive"
  || user.role === "worker"
  || user.role === "cleaner"
  || canView(user, "ppe")
  || canRequest(user, "ppe")
);

const writeAuditEvent = async (auditDriver, event) => {
  if (!auditDriver || !event) return;
  if (typeof auditDriver.write === "function") return auditDriver.write(event);
};

const upsertAuditEvent = (config, record, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.ppe,
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
  entityType: AUDIT_ENTITY_TYPES.ppe,
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

export function createPpeApiHandler({ drivers = null, auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDrivers = drivers || createSupabasePpeDriversFromEnv(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function ppeApiHandler(req, res) {
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
      if (!resource) return json(res, 400, { error: "ppe_resource_required" });
      const config = RESOURCE_CONFIG[resource];
      const backendDriver = backendDrivers?.[resource];
      if (!backendDriver) return json(res, 503, { error: config.backendError });

      if (method === "GET") {
        if (!canReadPpeRecords(auth.user)) return json(res, 403, { error: "permission_required:ppe:request" });
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
      if (error?.message === "ppe_movement_id_required") return json(res, 400, { error: "ppe_movement_id_required" });
      if (error?.message === "ppe_item_id_required") return json(res, 400, { error: "ppe_item_id_required" });
      if (error?.message === "ppe_norm_id_required") return json(res, 400, { error: "ppe_norm_id_required" });
      if (error?.message === "ppe_request_id_required") return json(res, 400, { error: "ppe_request_id_required" });
      if (error?.message === "ppe_order_id_required") return json(res, 400, { error: "ppe_order_id_required" });
      if (error instanceof SyntaxError) return json(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "ppe_api_error", route: "/api/ppe" });
    }
  };
}

export default createPpeApiHandler();
