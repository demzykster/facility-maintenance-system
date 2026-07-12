import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { canPerformCleaning, canViewCleaningReports } from "../../src/cleaningAccessModel.js";
import { normalizeCleaningZoneRecord } from "../../src/cleaningZoneRecordModel.js";
import { normalizeCleaningRoundRecord } from "../../src/cleaningRoundRecordModel.js";
import { normalizeCleaningComplaintRecord } from "../../src/cleaningComplaintRecordModel.js";
import { normalizeWorkerAbsenceRecord } from "../../src/workerAbsenceRecordModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { kvWritePermissionError } from "../kv/permissionPolicy.js";
import { bearerToken } from "../session/authCookie.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { createSupabaseCleaningZonesDriverFromEnv } from "./supabaseCleaningZonesDriver.js";
import { createSupabaseCleaningRoundsDriverFromEnv } from "./supabaseCleaningRoundsDriver.js";
import { createSupabaseCleaningComplaintsDriverFromEnv, createSupabaseWorkerAbsencesDriverFromEnv } from "./supabaseCleaningRecordsDriver.js";

const RESOURCE_CONFIG = Object.freeze({
  zones: {
    singular: "zone",
    plural: "zones",
    kvPrefix: "czone:",
    idError: "cleaning_zone_id_required",
    notFoundError: "cleaning_zone_not_found",
    backendError: "cleaning_zones_backend_not_configured",
    readError: "cleaning_zones_read_not_configured",
    deleteError: "cleaning_zones_delete_not_configured",
    source: "api/cleaning/records:zones",
    normalize: normalizeCleaningZoneRecord,
    summaryName: "Cleaning zone",
    after: (record) => ({ name: record.name, building: record.building, floor: record.floor, active: record.active })
  },
  rounds: {
    singular: "round",
    plural: "rounds",
    kvPrefix: "cround:",
    idError: "cleaning_round_id_required",
    notFoundError: "cleaning_round_not_found",
    backendError: "cleaning_rounds_backend_not_configured",
    readError: "cleaning_rounds_read_not_configured",
    deleteError: "cleaning_rounds_delete_not_configured",
    source: "api/cleaning/records:rounds",
    normalize: normalizeCleaningRoundRecord,
    summaryName: "Cleaning round",
    after: (record) => ({ zoneId: record.zoneId, cleanerName: record.cleanerName, status: record.status, roundAt: record.roundAt })
  },
  complaints: {
    singular: "complaint",
    plural: "complaints",
    kvPrefix: "ccomplaint:",
    idError: "cleaning_complaint_id_required",
    notFoundError: "cleaning_complaint_not_found",
    backendError: "cleaning_complaints_backend_not_configured",
    readError: "cleaning_complaints_read_not_configured",
    deleteError: "cleaning_complaints_delete_not_configured",
    source: "api/cleaning/records:complaints",
    normalize: normalizeCleaningComplaintRecord,
    summaryName: "Cleaning complaint",
    after: (record) => ({ zoneId: record.zoneId, status: record.status, kind: record.kind, complaintAt: record.complaintAt })
  },
  absences: {
    singular: "absence",
    plural: "absences",
    kvPrefix: "cabsence:",
    idError: "worker_absence_id_required",
    notFoundError: "worker_absence_not_found",
    backendError: "worker_absences_backend_not_configured",
    readError: "worker_absences_read_not_configured",
    deleteError: "worker_absences_delete_not_configured",
    source: "api/cleaning/records:absences",
    normalize: normalizeWorkerAbsenceRecord,
    summaryName: "Worker absence",
    after: (record) => ({ userId: record.userId, userName: record.userName, startsOn: record.startsOn, endsOn: record.endsOn })
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

const canReadCleaningRecords = (user = {}) => (
  user.role === "admin"
  || user.role === "executive"
  || canPerformCleaning(user)
  || canViewCleaningReports(user)
  || user.permissions?.settings === "manage"
  || user.permissions?.settings === "full"
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
  entityType: AUDIT_ENTITY_TYPES.cleaning,
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
  entityType: AUDIT_ENTITY_TYPES.cleaning,
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

const createDrivers = (env, fetchImpl) => ({
  zones: createSupabaseCleaningZonesDriverFromEnv(env, fetchImpl),
  rounds: createSupabaseCleaningRoundsDriverFromEnv(env, fetchImpl),
  complaints: createSupabaseCleaningComplaintsDriverFromEnv(env, fetchImpl),
  absences: createSupabaseWorkerAbsencesDriverFromEnv(env, fetchImpl)
});

export function createCleaningRecordsApiHandler({ drivers = null, auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDrivers = drivers || createDrivers(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function cleaningRecordsApiHandler(req, res) {
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
      if (!resource) return json(res, 400, { error: "cleaning_records_resource_required" });
      const config = RESOURCE_CONFIG[resource];
      const backendDriver = backendDrivers?.[resource];
      if (!backendDriver) return json(res, 503, { error: config.backendError });

      if (method === "GET") {
        if (!canReadCleaningRecords(auth.user)) return json(res, 403, { error: "permission_required:cleaning:view" });
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
      if (error?.message === "cleaning_complaint_id_required") return json(res, 400, { error: "cleaning_complaint_id_required" });
      if (error?.message === "cleaning_zone_id_required") return json(res, 400, { error: "cleaning_zone_id_required" });
      if (error?.message === "cleaning_round_id_required") return json(res, 400, { error: "cleaning_round_id_required" });
      if (error?.message === "worker_absence_id_required") return json(res, 400, { error: "worker_absence_id_required" });
      if (error instanceof SyntaxError) return json(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "cleaning_records_api_error", route: "/api/cleaning/records" });
    }
  };
}

export default createCleaningRecordsApiHandler();
