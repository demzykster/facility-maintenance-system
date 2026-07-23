import { sendServerError } from "../httpErrors.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const parseEnabled = (value) => value === true || value === "1" || value === "true";
const INSTALL_MARKER_ID = "install:completed";

const getHeader = (headers = {}, name) => {
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (direct) return direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match ? match[1] : "";
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizeName = (name) => String(name || "").trim() || "מנהל מערכת";

export function validateBootstrapAdminPayload(body = {}) {
  const email = normalizeEmail(body.email);
  const temporaryPassword = String(body.temporaryPassword || body.password || "");
  const name = normalizeName(body.name);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "valid_email_required" };
  }
  if (temporaryPassword.length < 6) {
    return { ok: false, error: "temporary_password_min_6_chars" };
  }

  return {
    ok: true,
    admin: {
      email,
      temporaryPassword,
      name,
      role: "admin",
      active: true,
      mustChangePassword: true,
      bootstrap: true
    }
  };
}

export function buildBootstrapAppUserProfile(admin, authUser) {
  return {
    auth_user_id: authUser.id,
    role: "admin",
    name: admin.name,
    email: admin.email,
    active: true,
    permissions: {},
    login_metadata: {
      source: "bootstrap",
      bootstrap: true
    },
    must_change_password: true
  };
}

const completedInstallMarker = (marker) => {
  const config = marker?.config || {};
  return config.status === "completed" || config.firstInstallCompleted === true;
};

const bootstrapAuditEvent = (appUser = {}, options = {}) => normalizeAuditEvent({
  at: Date.now(),
  actorId: "system",
  actorName: options.recovery ? "admin-recovery-bootstrap" : "bootstrap",
  actorRole: "system",
  entityType: AUDIT_ENTITY_TYPES.user,
  entityId: appUser.id || appUser.authUserId || appUser.email || "admin",
  action: AUDIT_ACTIONS.bootstrap,
  summary: options.recovery ? "Admin recovered through env-gated bootstrap" : "First admin created through bootstrap",
  after: {
    id: appUser.id || "",
    email: appUser.email || "",
    role: "admin",
    active: true
  },
  metadata: { source: "bootstrap", recovery: options.recovery === true }
});

export function bootstrapAuthorization(req, env = {}) {
  const configuredToken = String(env.CMMS_BOOTSTRAP_TOKEN || "");
  if (!configuredToken) return { ok: false, status: 503, error: "bootstrap_auth_not_configured" };

  const bearer = String(getHeader(req.headers, "authorization") || "");
  const headerToken = String(getHeader(req.headers, "x-cmms-bootstrap-token") || "");
  const requestToken = bearer.startsWith("Bearer ") ? bearer.slice(7) : headerToken;

  if (requestToken !== configuredToken) return { ok: false, status: 401, error: "bootstrap_unauthorized" };
  return { ok: true };
}

async function responseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function createSupabaseAdminBootstrapClient({ url, serviceRoleKey, fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");

  return {
    async createAdmin(admin) {
      const response = await fetchImpl(`${root}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email: admin.email,
          password: admin.temporaryPassword,
          email_confirm: true,
          user_metadata: {
            name: admin.name,
            role: "admin",
            cmms_role: "admin",
            cmms_bootstrap: true,
            must_change_password: true
          },
          app_metadata: {
            role: "admin",
            cmms_role: "admin"
          }
        })
      });

      const data = await responseJson(response);
      if (!response.ok) {
        throw new Error(data?.message || data?.msg || data?.error_description || data?.error || `supabase_auth_${response.status}`);
      }

      const user = data?.user || data;
      return {
        id: user?.id || "",
        email: user?.email || admin.email,
        role: "admin",
        mustChangePassword: true
      };
    },
    async hasExistingActiveAdmin() {
      const response = await fetchImpl(`${root}/rest/v1/app_users?role=eq.admin&active=is.true&select=id&limit=1`, {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`
        }
      });

      const data = await responseJson(response);
      if (!response.ok) {
        throw new Error(data?.message || data?.details || data?.hint || data?.code || `supabase_profile_check_${response.status}`);
      }
      return Array.isArray(data) && data.length > 0;
    },
    async getPermanentInstallMarker() {
      const response = await fetchImpl(`${root}/rest/v1/app_config?id=eq.${encodeURIComponent(INSTALL_MARKER_ID)}&select=id,config,updated_at&limit=1`, {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`
        }
      });

      const data = await responseJson(response);
      if (!response.ok) {
        throw new Error(data?.message || data?.details || data?.hint || data?.code || `supabase_install_marker_${response.status}`);
      }
      return Array.isArray(data) ? data[0] : data;
    },
    async setPermanentInstallMarker(metadata = {}) {
      const now = new Date().toISOString();
      const response = await fetchImpl(`${root}/rest/v1/app_config?on_conflict=id`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
          prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({
          id: INSTALL_MARKER_ID,
          source_kv_key: INSTALL_MARKER_ID,
          legacy_payload: {},
          config: {
            source: "bootstrap",
            status: "completed",
            firstInstallCompleted: true,
            completedAt: now,
            updatedAt: now,
            ...metadata
          }
        })
      });
      const data = await responseJson(response);
      if (!response.ok) {
        throw new Error(data?.message || data?.details || data?.hint || data?.code || `supabase_install_marker_set_${response.status}`);
      }
    },
    async createAppUserProfile(admin, authUser) {
      if (!authUser?.id) throw new Error("supabase_auth_user_id_missing");
      const profile = buildBootstrapAppUserProfile(admin, authUser);
      const response = await fetchImpl(`${root}/rest/v1/app_users`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
          prefer: "return=representation"
        },
        body: JSON.stringify(profile)
      });

      const data = await responseJson(response);
      if (!response.ok) {
        throw new Error(data?.message || data?.details || data?.hint || data?.code || `supabase_profile_${response.status}`);
      }

      const row = Array.isArray(data) ? data[0] : data;
      return {
        id: row?.id || "",
        authUserId: row?.auth_user_id || authUser.id,
        email: row?.email || admin.email,
        role: row?.role || "admin",
        active: row?.active !== false,
        mustChangePassword: row?.must_change_password !== false
      };
    }
  };
}

export function createBootstrapAdminHandler({
  env = process.env,
  supabaseClient = null,
  auditDriver = null,
  fetchImpl = globalThis.fetch
} = {}) {
  return async function bootstrapAdminHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "POST") {
      res.setHeader("allow", "POST");
      return json(res, 405, { error: "method_not_allowed" });
    }

    if (!parseEnabled(env.CMMS_BOOTSTRAP_ENABLED)) {
      return json(res, 503, { error: "bootstrap_disabled" });
    }

    const auth = bootstrapAuthorization(req, env);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    const client = supabaseClient || createSupabaseAdminBootstrapClient({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      fetchImpl
    });
    if (!client || typeof client.createAdmin !== "function" || typeof client.createAppUserProfile !== "function") {
      return json(res, 503, { error: "supabase_admin_not_configured" });
    }
    const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

    try {
      const body = await readBody(req);
      const validated = validateBootstrapAdminPayload(body);
      if (!validated.ok) return json(res, 400, { error: validated.error });

      if (typeof client.hasExistingActiveAdmin === "function" && await client.hasExistingActiveAdmin()) {
        return json(res, 409, { error: "bootstrap_admin_already_exists" });
      }
      const marker = typeof client.getPermanentInstallMarker === "function" ? await client.getPermanentInstallMarker() : null;
      const recovery = completedInstallMarker(marker);
      if (recovery && !parseEnabled(env.CMMS_BOOTSTRAP_ALLOW_ADMIN_RECOVERY)) {
        return json(res, 409, { error: "admin_recovery_requires_explicit_bootstrap" });
      }
      if (typeof backendAuditDriver?.write !== "function") {
        return json(res, 503, { error: "bootstrap_audit_not_configured" });
      }
      if (typeof client.setPermanentInstallMarker !== "function") {
        return json(res, 503, { error: "bootstrap_install_marker_not_configured" });
      }

      const admin = await client.createAdmin(validated.admin);
      let appUser = null;
      try {
        appUser = await client.createAppUserProfile(validated.admin, admin);
      } catch (profileError) {
        return sendServerError(req, res, profileError, {
          code: "bootstrap_profile_error",
          route: "/api/bootstrap/admin",
          extra: {
            authUserCreated: true,
            authUserId: admin.id || ""
          }
        });
      }
      await backendAuditDriver.write(bootstrapAuditEvent(appUser, { recovery }));
      await client.setPermanentInstallMarker({
        source: "bootstrap",
        recovery,
        appUserId: appUser.id || "",
        authUserId: appUser.authUserId || admin.id || "",
        email: appUser.email || validated.admin.email || ""
      });
      return json(res, 200, {
        ok: true,
        admin,
        appUser,
        disableBootstrapAfterSuccess: true
      });
    } catch (error) {
      return sendServerError(req, res, error, { code: "bootstrap_admin_error", route: "/api/bootstrap/admin" });
    }
  };
}

export default createBootstrapAdminHandler();
