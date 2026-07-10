import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { APP_CONFIG_ID, APP_CONFIG_KEY, parseAppConfigValue, serializeAppConfigValue } from "../../src/appConfigRecordModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { kvReadPermissionError, kvWritePermissionError } from "../kv/permissionPolicy.js";
import { createSupabaseKvDriverFromEnv } from "../kv/supabaseDriver.js";
import { bearerToken } from "../session/authCookie.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { createSupabaseAppConfigDriverFromEnv } from "./supabaseAppConfigDriver.js";
import { retiredKvWriteKey } from "../../src/retiredKvWriteModel.js";

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

const configAuditEvent = (actor, action, config = {}) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.settings,
  entityId: APP_CONFIG_KEY,
  action,
  summary: `App config ${action} through normalized API`,
  after: action === AUDIT_ACTIONS.delete ? {} : { sourceKvKey: APP_CONFIG_KEY, keys: Object.keys(config || {}).sort().slice(0, 40) },
  before: action === AUDIT_ACTIONS.delete ? { sourceKvKey: APP_CONFIG_KEY } : {},
  metadata: { source: "api/settings/config", sourceKvKey: APP_CONFIG_KEY }
});

async function readConfig(configDriver, mirrorDriver) {
  if (configDriver?.get) {
    const record = await configDriver.get(APP_CONFIG_ID);
    if (record) return { config: record.config, source: "normalized" };
  }
  if (mirrorDriver?.get) {
    const raw = await mirrorDriver.get(APP_CONFIG_KEY, true);
    if (raw) return { config: parseAppConfigValue(raw), source: "kv" };
  }
  return { config: {}, source: "empty" };
}

export function createSettingsConfigApiHandler({ configDriver = null, mirrorDriver = null, auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendConfigDriver = configDriver || createSupabaseAppConfigDriverFromEnv(env, fetchImpl);
  const retiredConfigMirror = retiredKvWriteKey(APP_CONFIG_KEY, {
    appMode: env.VITE_CMMS_APP_MODE,
    storageProvider: env.VITE_CMMS_STORAGE_PROVIDER
  });
  const backendMirrorDriver = retiredConfigMirror ? null : (mirrorDriver || createSupabaseKvDriverFromEnv(env, fetchImpl));
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function settingsConfigApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    try {
      const method = String(req.method || "GET").toUpperCase();
      if (!["GET", "PUT", "POST", "DELETE"].includes(method)) {
        res.setHeader("allow", "GET, PUT, POST, DELETE");
        return json(res, 405, { error: "method_not_allowed" });
      }

      if (method === "GET") {
        const permissionError = kvReadPermissionError(auth.user, APP_CONFIG_KEY);
        if (permissionError) return json(res, 403, { error: permissionError });
        if (!backendConfigDriver?.get && !backendMirrorDriver?.get) return json(res, 503, { error: "app_config_backend_not_configured" });
        const result = await readConfig(backendConfigDriver, backendMirrorDriver);
        return json(res, 200, { ok: true, value: serializeAppConfigValue(result.config), config: result.config, source: result.source });
      }

      const permissionError = kvWritePermissionError(auth.user, APP_CONFIG_KEY);
      if (permissionError) return json(res, 403, { error: permissionError });
      if (!backendConfigDriver?.upsert && method !== "DELETE") return json(res, 503, { error: "app_config_backend_not_configured" });

      if (method === "DELETE") {
        if (backendConfigDriver?.delete) await backendConfigDriver.delete(APP_CONFIG_ID);
        if (backendMirrorDriver?.delete) await backendMirrorDriver.delete(APP_CONFIG_KEY, true);
        await writeAuditEvent(backendAuditDriver, configAuditEvent(auth.user, AUDIT_ACTIONS.delete));
        return json(res, 200, { ok: true });
      }

      const body = await readBody(req);
      const config = parseAppConfigValue(body?.config ?? body?.value ?? body);
      const record = await backendConfigDriver.upsert(config, APP_CONFIG_ID);
      if (backendMirrorDriver?.set) await backendMirrorDriver.set(APP_CONFIG_KEY, serializeAppConfigValue(record.config), true);
      await writeAuditEvent(backendAuditDriver, configAuditEvent(auth.user, AUDIT_ACTIONS.update, record.config));
      return json(res, 200, { ok: true, value: serializeAppConfigValue(record.config), config: record.config, source: "normalized" });
    } catch (error) {
      if (error instanceof SyntaxError) return json(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "settings_config_api_error", route: "/api/settings/config" });
    }
  };
}

export default createSettingsConfigApiHandler();
