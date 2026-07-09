import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { canPerformCleaning, canViewCleaningReports } from "../../src/cleaningAccessModel.js";
import { normalizeCleaningZoneRecord } from "../../src/cleaningZoneRecordModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { kvWritePermissionError } from "../kv/permissionPolicy.js";
import { bearerToken } from "../session/authCookie.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { createSupabaseCleaningZonesDriverFromEnv } from "./supabaseCleaningZonesDriver.js";

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

const zoneUpsertAuditEvent = (zone, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.cleaning,
  entityId: zone.id,
  action: AUDIT_ACTIONS.update,
  summary: `Cleaning zone upserted through normalized API: ${zone.id}`,
  after: { name: zone.name, building: zone.building, floor: zone.floor, active: zone.active },
  metadata: { source: "api/cleaning/zones", sourceKvKey: zone.sourceKvKey }
});

const zoneDeleteAuditEvent = (zoneId, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.cleaning,
  entityId: zoneId,
  action: AUDIT_ACTIONS.delete,
  summary: `Cleaning zone deleted through normalized API: ${zoneId}`,
  before: { id: zoneId },
  metadata: { source: "api/cleaning/zones", sourceKvKey: `czone:${zoneId}` }
});

const canReadCleaningZones = (user = {}) => (
  user.role === "admin"
  || canPerformCleaning(user)
  || canViewCleaningReports(user)
  || user.permissions?.settings === "manage"
  || user.permissions?.settings === "full"
);

export function createCleaningZonesApiHandler({ driver = null, auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDriver = driver || createSupabaseCleaningZonesDriverFromEnv(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function cleaningZonesApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    if (!backendDriver) return json(res, 503, { error: "cleaning_zones_backend_not_configured" });

    try {
      const method = String(req.method || "GET").toUpperCase();
      if (!["GET", "POST", "DELETE"].includes(method)) {
        res.setHeader("allow", "GET, POST, DELETE");
        return json(res, 405, { error: "method_not_allowed" });
      }

      if (method === "GET") {
        if (!canReadCleaningZones(auth.user)) return json(res, 403, { error: "permission_required:cleaning:view" });
        if (typeof backendDriver.get !== "function" || typeof backendDriver.list !== "function") return json(res, 503, { error: "cleaning_zones_read_not_configured" });
        const id = String(req.query?.id || "").trim();
        if (id) {
          const zone = await backendDriver.get(id);
          if (!zone) return json(res, 404, { error: "cleaning_zone_not_found" });
          return json(res, 200, { ok: true, zone });
        }
        const zones = await backendDriver.list({ limit: req.query?.limit });
        return json(res, 200, { ok: true, zones });
      }

      const body = await readBody(req);
      if (method === "DELETE") {
        const id = String(req.query?.id || body?.id || body?.zone?.id || "").trim();
        if (!id) return json(res, 400, { error: "cleaning_zone_id_required" });
        const permissionError = kvWritePermissionError(auth.user, `czone:${id}`);
        if (permissionError) return json(res, 403, { error: permissionError });
        if (typeof backendDriver.delete !== "function") return json(res, 503, { error: "cleaning_zones_delete_not_configured" });
        await backendDriver.delete(id);
        await writeAuditEvent(backendAuditDriver, zoneDeleteAuditEvent(id, auth.user));
        return json(res, 200, { ok: true, zone: { id } });
      }

      const zone = normalizeCleaningZoneRecord(body?.zone || body);
      const permissionError = kvWritePermissionError(auth.user, `czone:${zone.id}`);
      if (permissionError) return json(res, 403, { error: permissionError });

      await backendDriver.upsert(zone.legacyPayload);
      await writeAuditEvent(backendAuditDriver, zoneUpsertAuditEvent(zone, auth.user));
      return json(res, 200, { ok: true, zone: { id: zone.id, name: zone.name, sourceKvKey: zone.sourceKvKey } });
    } catch (error) {
      if (error?.message === "cleaning_zone_id_required") return json(res, 400, { error: "cleaning_zone_id_required" });
      if (error instanceof SyntaxError) return json(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "cleaning_zones_api_error", route: "/api/cleaning/zones" });
    }
  };
}

export default createCleaningZonesApiHandler();
