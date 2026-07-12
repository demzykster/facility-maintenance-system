import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { normalizeFleetRecord } from "../../src/fleetRecordModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { bearerToken } from "../session/authCookie.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { kvWritePermissionError } from "../kv/permissionPolicy.js";
import { createSupabaseFleetDriverFromEnv } from "./supabaseFleetDriver.js";

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

const fleetUpsertAuditEvent = (unit, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.fleet,
  entityId: unit.id,
  action: AUDIT_ACTIONS.update,
  summary: `Fleet unit upserted through normalized API: ${unit.id}`,
  after: { code: unit.code, type: unit.type, model: unit.model, status: unit.status },
  metadata: { source: "api/fleet", sourceKvKey: unit.sourceKvKey }
});

const fleetDeleteAuditEvent = (unitId, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.fleet,
  entityId: unitId,
  action: AUDIT_ACTIONS.delete,
  summary: `Fleet unit deleted through normalized API: ${unitId}`,
  before: { id: unitId },
  metadata: { source: "api/fleet", sourceKvKey: `fleet:${unitId}` }
});

const canReadFleet = (user = {}) => ["admin", "executive", "user", "tech"].includes(user?.role);

export function createFleetApiHandler({ driver = null, auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDriver = driver || createSupabaseFleetDriverFromEnv(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function fleetApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    if (!backendDriver) return json(res, 503, { error: "fleet_backend_not_configured" });

    try {
      const method = String(req.method || "GET").toUpperCase();
      if (!["GET", "POST", "DELETE"].includes(method)) {
        res.setHeader("allow", "GET, POST, DELETE");
        return json(res, 405, { error: "method_not_allowed" });
      }

      if (method === "GET") {
        if (!canReadFleet(auth.user)) return json(res, 403, { error: "permission_required:fleet:view" });
        if (typeof backendDriver.get !== "function" || typeof backendDriver.list !== "function") return json(res, 503, { error: "fleet_read_not_configured" });
        const id = String(req.query?.id || "").trim();
        if (id) {
          const unit = await backendDriver.get(id);
          if (!unit) return json(res, 404, { error: "fleet_unit_not_found" });
          return json(res, 200, { ok: true, unit });
        }
        const units = await backendDriver.list({ limit: req.query?.limit });
        return json(res, 200, { ok: true, units });
      }

      const body = await readBody(req);
      if (method === "DELETE") {
        const id = String(req.query?.id || body?.id || body?.unit?.id || "").trim();
        if (!id) return json(res, 400, { error: "fleet_id_required" });
        const permissionError = kvWritePermissionError(auth.user, `fleet:${id}`);
        if (permissionError) return json(res, 403, { error: permissionError });
        if (typeof backendDriver.delete !== "function") return json(res, 503, { error: "fleet_delete_not_configured" });
        await backendDriver.delete(id);
        await writeAuditEvent(backendAuditDriver, fleetDeleteAuditEvent(id, auth.user));
        return json(res, 200, { ok: true, unit: { id } });
      }

      const unit = normalizeFleetRecord(body?.unit || body);
      const permissionError = kvWritePermissionError(auth.user, `fleet:${unit.id}`);
      if (permissionError) return json(res, 403, { error: permissionError });

      await backendDriver.upsert(unit.legacyPayload);
      await writeAuditEvent(backendAuditDriver, fleetUpsertAuditEvent(unit, auth.user));
      return json(res, 200, { ok: true, unit: { id: unit.id, code: unit.code, sourceKvKey: unit.sourceKvKey } });
    } catch (error) {
      if (error?.message === "fleet_id_required") return json(res, 400, { error: "fleet_id_required" });
      return sendServerError(req, res, error, { code: "fleet_api_error", route: "/api/fleet" });
    }
  };
}

export default createFleetApiHandler();
