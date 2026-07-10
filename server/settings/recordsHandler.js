import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { normalizeAppIssueRecord } from "../../src/appIssueModel.js";
import { normalizeLocationRecord } from "../../src/locationModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { kvReadPermissionError, kvWritePermissionError } from "../kv/permissionPolicy.js";
import { bearerToken } from "../session/authCookie.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { createSupabaseSettingsRecordsDriversFromEnv } from "./supabaseSettingsRecordsDriver.js";

const RESOURCE_CONFIG = Object.freeze({
  locations: {
    singular: "location",
    plural: "locations",
    kvPrefix: "location:",
    idError: "location_id_required",
    notFoundError: "location_not_found",
    backendError: "locations_backend_not_configured",
    readError: "locations_read_not_configured",
    deleteError: "locations_delete_not_configured",
    normalize: normalizeLocationRecord,
    entityType: AUDIT_ENTITY_TYPES.settings,
    summaryName: "Location"
  },
  appIssues: {
    singular: "appIssue",
    plural: "appIssues",
    kvPrefix: "appIssue:",
    idError: "app_issue_id_required",
    notFoundError: "app_issue_not_found",
    backendError: "app_issues_backend_not_configured",
    readError: "app_issues_read_not_configured",
    deleteError: "app_issues_delete_not_configured",
    normalize: normalizeAppIssueRecord,
    entityType: AUDIT_ENTITY_TYPES.settings,
    summaryName: "App issue"
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

const writeAuditEvent = async (auditDriver, event) => {
  if (!auditDriver || !event) return;
  if (typeof auditDriver.write === "function") return auditDriver.write(event);
};

const settingsRecordAuditEvent = (config, record, actor, action) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: config.entityType,
  entityId: record.id,
  action,
  summary: `${config.summaryName} ${action} through normalized API: ${record.id}`,
  after: action === AUDIT_ACTIONS.delete ? {} : { id: record.id, sourceKvKey: record.sourceKvKey },
  before: action === AUDIT_ACTIONS.delete ? { id: record.id } : {},
  metadata: { source: "api/settings/records", sourceKvKey: `${config.kvPrefix}${record.id}` }
});

const resourceFromRequest = (req, body = {}) => {
  const value = String(req.query?.resource || body?.resource || "").trim();
  return RESOURCE_CONFIG[value] ? value : "";
};

export function createSettingsRecordsApiHandler({ drivers = null, auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDrivers = drivers || createSupabaseSettingsRecordsDriversFromEnv(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function settingsRecordsApiHandler(req, res) {
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
      if (!resource) return json(res, 400, { error: "settings_records_resource_required" });
      const config = RESOURCE_CONFIG[resource];
      const backendDriver = backendDrivers?.[resource];
      if (!backendDriver) return json(res, 503, { error: config.backendError });

      if (method === "GET") {
        const id = String(req.query?.id || "").trim();
        const readKey = `${config.kvPrefix}${id || "*"}`;
        const permissionError = kvReadPermissionError(auth.user, readKey);
        if (permissionError) return json(res, 403, { error: permissionError });
        if (typeof backendDriver.get !== "function" || typeof backendDriver.list !== "function") return json(res, 503, { error: config.readError });
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
        await writeAuditEvent(backendAuditDriver, settingsRecordAuditEvent(config, { id }, auth.user, AUDIT_ACTIONS.delete));
        return json(res, 200, { ok: true, [config.singular]: { id } });
      }

      const record = config.normalize(body?.[config.singular] || body);
      const permissionError = kvWritePermissionError(auth.user, `${config.kvPrefix}${record.id}`);
      if (permissionError) return json(res, 403, { error: permissionError });
      await backendDriver.upsert(record.legacyPayload);
      await writeAuditEvent(backendAuditDriver, settingsRecordAuditEvent(config, record, auth.user, AUDIT_ACTIONS.update));
      return json(res, 200, { ok: true, [config.singular]: { id: record.id, sourceKvKey: record.sourceKvKey } });
    } catch (error) {
      if (["location_id_required", "location_name_required", "app_issue_id_required"].includes(error?.message)) return json(res, 400, { error: error.message });
      if (error instanceof SyntaxError) return json(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "settings_records_api_error", route: "/api/settings/records" });
    }
  };
}

export default createSettingsRecordsApiHandler();
