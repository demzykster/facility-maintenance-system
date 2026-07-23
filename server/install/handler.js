import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";

const INSTALL_LOCK_ID = "install:first-admin";
const INSTALL_LOCK_SOURCE = "first-run-install";

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store, max-age=0");
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
};

const cleanString = (value) => String(value || "").trim();
const normalizeEmail = (value) => cleanString(value).toLowerCase();
const normalizeName = (value) => cleanString(value) || "מנהל מערכת";

const readJsonOrText = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const serviceHeaders = (serviceRoleKey, extra = {}) => ({
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
  ...extra
});

const errorMessage = (data, fallback) => data?.message || data?.details || data?.hint || data?.code || data?.error || fallback;

export function validateFirstRunAdminPayload(body = {}) {
  const name = normalizeName(body.name);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const confirmPassword = String(body.confirmPassword || body.passwordConfirm || "");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "valid_email_required" };
  if (password.length < 8) return { ok: false, error: "password_min_8_chars" };
  if (confirmPassword && password !== confirmPassword) return { ok: false, error: "password_confirmation_mismatch" };

  return {
    ok: true,
    admin: {
      name,
      email,
      password,
      role: "admin",
      active: true
    }
  };
}

export function buildFirstRunAppUserProfile(admin = {}, authUser = {}) {
  return {
    auth_user_id: authUser.id,
    role: "admin",
    name: admin.name,
    email: admin.email,
    active: true,
    permissions: {},
    login_state: "active",
    login_metadata: {
      source: INSTALL_LOCK_SOURCE,
      first_run: true
    },
    must_change_password: false
  };
}

const installAuditEvent = (appUser = {}, admin = {}) => normalizeAuditEvent({
  at: Date.now(),
  actorId: "system",
  actorName: "first-run-install",
  actorRole: "system",
  entityType: AUDIT_ENTITY_TYPES.user,
  entityId: appUser.id || appUser.authUserId || admin.email,
  action: AUDIT_ACTIONS.bootstrap,
  summary: "First admin created through first-run installation",
  before: { activeAdminCount: 0 },
  after: {
    id: appUser.id || "",
    email: admin.email || appUser.email || "",
    role: "admin",
    active: true
  },
  metadata: { source: INSTALL_LOCK_SOURCE }
});

const installStateFrom = ({ hasActiveAdmin, lock }) => {
  if (hasActiveAdmin) return { ok: true, state: "ready" };
  const status = String(lock?.config?.status || "").trim();
  if (status === "pending") return { ok: true, state: "blocked", reason: "install_in_progress" };
  if (status === "failed") return { ok: true, state: "blocked", reason: "install_recovery_required" };
  return { ok: true, state: "new" };
};

async function writeAuditEvent(auditDriver, event) {
  if (typeof auditDriver?.write !== "function") return;
  await auditDriver.write(event);
}

export function createSupabaseInstallClient({ url, serviceRoleKey, fetchImpl = globalThis.fetch, appConfigTable = "app_config" } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const appUsersBase = `${root}/rest/v1/app_users`;
  const configBase = `${root}/rest/v1/${encodeURIComponent(appConfigTable)}`;

  return {
    async hasExistingActiveAdmin() {
      const response = await fetchImpl(`${appUsersBase}?role=eq.admin&active=is.true&select=id&limit=1`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `install_admin_check_${response.status}`));
      return Array.isArray(data) && data.length > 0;
    },
    async getInstallLock() {
      const response = await fetchImpl(`${configBase}?id=eq.${encodeURIComponent(INSTALL_LOCK_ID)}&select=id,config,updated_at&limit=1`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `install_lock_get_${response.status}`));
      return Array.isArray(data) && data[0] ? data[0] : null;
    },
    async acquireInstallLock() {
      const now = new Date().toISOString();
      const row = {
        id: INSTALL_LOCK_ID,
        config: {
          source: INSTALL_LOCK_SOURCE,
          status: "pending",
          createdAt: now,
          updatedAt: now
        },
        source_kv_key: INSTALL_LOCK_ID,
        legacy_payload: {}
      };
      const response = await fetchImpl(configBase, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=representation" }),
        body: JSON.stringify(row)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) {
        const code = errorMessage(data, `install_lock_${response.status}`);
        const error = new Error(response.status === 409 || /duplicate|23505/i.test(code) ? "install_lock_exists" : code);
        error.status = response.status;
        throw error;
      }
      return Array.isArray(data) && data[0] ? data[0] : row;
    },
    async markInstallLock(status, metadata = {}) {
      const now = new Date().toISOString();
      const response = await fetchImpl(`${configBase}?id=eq.${encodeURIComponent(INSTALL_LOCK_ID)}`, {
        method: "PATCH",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" }),
        body: JSON.stringify({
          config: {
            source: INSTALL_LOCK_SOURCE,
            status,
            updatedAt: now,
            ...metadata
          }
        })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `install_lock_update_${response.status}`));
    },
    async createAuthAdmin(admin) {
      const response = await fetchImpl(`${root}/auth/v1/admin/users`, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey),
        body: JSON.stringify({
          email: admin.email,
          password: admin.password,
          email_confirm: true,
          user_metadata: {
            name: admin.name,
            role: "admin",
            cmms_role: "admin",
            cmms_first_run: true
          },
          app_metadata: {
            role: "admin",
            cmms_role: "admin"
          }
        })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `install_auth_${response.status}`));
      const user = data?.user || data;
      return {
        id: user?.id || "",
        email: user?.email || admin.email,
        role: "admin"
      };
    },
    async createAppUserProfile(admin, authUser) {
      if (!authUser?.id) throw new Error("install_auth_user_id_missing");
      const profile = buildFirstRunAppUserProfile(admin, authUser);
      const response = await fetchImpl(appUsersBase, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=representation" }),
        body: JSON.stringify(profile)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `install_profile_${response.status}`));
      const row = Array.isArray(data) ? data[0] : data;
      return {
        id: row?.id || "",
        authUserId: row?.auth_user_id || authUser.id,
        email: row?.email || admin.email,
        role: row?.role || "admin",
        active: row?.active !== false
      };
    }
  };
}

export function createInstallHandler({
  env = process.env,
  installClient = null,
  auditDriver = null,
  fetchImpl = globalThis.fetch
} = {}) {
  return async function installHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (!["GET", "HEAD", "POST"].includes(method)) {
      res.setHeader("allow", "GET, HEAD, POST");
      return json(res, 405, { error: "method_not_allowed" });
    }

    const client = installClient || createSupabaseInstallClient({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      appConfigTable: env.CMMS_APP_CONFIG_SUPABASE_TABLE || "app_config",
      fetchImpl
    });
    if (!client || typeof client.hasExistingActiveAdmin !== "function") {
      return json(res, 503, { error: "install_backend_not_configured" });
    }
    const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

    try {
      const hasActiveAdmin = await client.hasExistingActiveAdmin();
      if (method === "HEAD") {
        res.statusCode = hasActiveAdmin ? 200 : 204;
        res.setHeader("cache-control", "no-store, max-age=0");
        return res.end();
      }

      if (method === "GET") {
        if (hasActiveAdmin) return json(res, 200, installStateFrom({ hasActiveAdmin, lock: null }));
        const lock = typeof client.getInstallLock === "function" ? await client.getInstallLock() : null;
        return json(res, 200, installStateFrom({ hasActiveAdmin, lock }));
      }

      if (hasActiveAdmin) return json(res, 409, { error: "system_already_initialized" });

      const body = await readBody(req);
      const validated = validateFirstRunAdminPayload(body);
      if (!validated.ok) return json(res, 400, { error: validated.error });
      if (typeof client.acquireInstallLock !== "function") return json(res, 503, { error: "install_lock_not_configured" });

      try {
        await client.acquireInstallLock();
      } catch (error) {
        if (error?.message === "install_lock_exists") return json(res, 409, { error: "system_install_in_progress" });
        throw error;
      }

      if (await client.hasExistingActiveAdmin()) {
        await client.markInstallLock?.("ready");
        return json(res, 409, { error: "system_already_initialized" });
      }

      let authUser = null;
      try {
        authUser = await client.createAuthAdmin(validated.admin);
      } catch (error) {
        await client.markInstallLock?.("failed", { phase: "auth" });
        return sendServerError(req, res, error, { code: "install_auth_error", route: "/api/install" });
      }

      let appUser = null;
      try {
        appUser = await client.createAppUserProfile(validated.admin, authUser);
      } catch (error) {
        await client.markInstallLock?.("failed", { phase: "app_users", authUserCreated: true });
        return sendServerError(req, res, error, { code: "install_profile_error", route: "/api/install" });
      }

      await client.markInstallLock?.("ready");
      await writeAuditEvent(backendAuditDriver, installAuditEvent(appUser, validated.admin));

      return json(res, 201, {
        ok: true,
        state: "ready",
        admin: {
          id: appUser.id,
          email: appUser.email,
          role: "admin",
          active: true
        }
      });
    } catch (error) {
      if (error instanceof SyntaxError) return json(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "install_error", route: "/api/install" });
    }
  };
}

export default createInstallHandler();
