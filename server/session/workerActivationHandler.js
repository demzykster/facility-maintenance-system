import { createSupabaseKvDriverFromEnv } from "../kv/supabaseDriver.js";
import { createUpstashKvDriverFromEnv } from "../kv/upstashDriver.js";

const ACTIVATION_PIN_ROLES = new Set(["worker", "cleaner", "tech"]);
const ACTIVATION_PASSWORD_ROLES = new Set(["admin", "user"]);

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
};

const parseStoredUser = (record) => {
  if (!record?.value) return null;
  try {
    const user = JSON.parse(record.value);
    return user && typeof user === "object" ? { key: record.key, user } : null;
  } catch {
    return null;
  }
};

const isPinActivationRole = (role) => ACTIVATION_PIN_ROLES.has(String(role || ""));
const isPasswordActivationRole = (role) => ACTIVATION_PASSWORD_ROLES.has(String(role || ""));
const isActivationLinkRole = (role) => isPinActivationRole(role) || isPasswordActivationRole(role);

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

const isActivatableUser = (user, token) => (
  isActivationLinkRole(user?.role)
  && user.active !== false
  && user.activationStatus === "pending"
  && user.activationToken === token
);

const publicActivationUser = (user = {}) => ({
  name: user.name || "",
  role: user.role || "worker",
  email: user.email || "",
  workerNo: user.workerNo || ""
});

const publicActivatedSession = (user = {}) => ({
  id: user.id || "",
  name: user.name || "",
  role: user.role || "worker",
  dept: user.dept || "",
  depts: Array.isArray(user.depts) ? user.depts : (user.dept ? [user.dept] : []),
  email: user.email || "",
  phone: user.phone || "",
  workerNo: user.workerNo || "",
  supplier: user.supplier || "",
  shiftStart: user.shiftStart || "",
  shiftEnd: user.shiftEnd || "16:30",
  shiftId: user.shiftId || "",
  techScope: user.techScope || "transport",
  techCats: Array.isArray(user.techCats) ? user.techCats : [],
  mgrZones: Array.isArray(user.mgrZones) ? user.mgrZones : [],
  shift: user.shift || "",
  perms: user.perms || user.permissions || {}
});

async function findActivationRecord(driver, token) {
  const records = await driver.listValues("user:", true);
  return (records || [])
    .map(parseStoredUser)
    .filter(Boolean)
    .find(({ user }) => isActivatableUser(user, token));
}

function createDefaultDriver(env, fetchImpl) {
  return (env.CMMS_KV_DRIVER === "upstash" ? createUpstashKvDriverFromEnv(env, fetchImpl) : null)
    || (env.CMMS_KV_DRIVER === "supabase" ? createSupabaseKvDriverFromEnv(env, fetchImpl) : null);
}

function createSupabasePasswordActivationClient(env, fetchImpl) {
  const supabaseUrl = trimSlash(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const anonKey = String(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !fetchImpl) return null;

  const serviceHeaders = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json"
  };

  const readJson = async (response) => {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  };

  const appUserProfile = (user, authUserId) => ({
    auth_user_id: authUserId,
    role: user.role || "user",
    name: user.name || normalizeEmail(user.email),
    email: normalizeEmail(user.email),
    phone: user.phone || null,
    department: user.dept || null,
    departments: Array.isArray(user.depts) ? user.depts : (user.dept ? [user.dept] : []),
    permissions: user.perms || user.permissions || {},
    manager_zones: Array.isArray(user.mgrZones) ? user.mgrZones : [],
    tech_scope: user.techScope || null,
    tech_cats: Array.isArray(user.techCats) ? user.techCats : [],
    supplier: user.supplier || null,
    active: user.active !== false,
    must_change_password: false,
    login_metadata: {
      source: "activation-link",
      cmms_user_id: user.id || ""
    }
  });

  async function createOrUpdateAuthUser(user, password) {
    const email = normalizeEmail(user.email);
    if (!email) throw new Error("email_required");
    const body = {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: user.name || email,
        cmms_user_id: user.id || "",
        role: user.role || "user"
      },
      app_metadata: {
        cmms_role: user.role || "user"
      }
    };

    if (user.authUserId) {
      const response = await fetchImpl(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(user.authUserId)}`, {
        method: "PUT",
        headers: serviceHeaders,
        body: JSON.stringify(body)
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.message || data?.error || "auth_user_update_failed");
      return data?.id || user.authUserId;
    }

    const response = await fetchImpl(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify(body)
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data?.message || data?.error || "auth_user_create_failed");
    return data?.id || data?.user?.id || "";
  }

  async function upsertAppUser(user, authUserId) {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/app_users?on_conflict=auth_user_id`, {
      method: "POST",
      headers: {
        ...serviceHeaders,
        prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(appUserProfile(user, authUserId))
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data?.message || data?.error || "app_user_upsert_failed");
    return Array.isArray(data) ? data[0] : data;
  }

  async function signIn(email, password) {
    const response = await fetchImpl(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({ email: normalizeEmail(email), password })
    });
    const data = await readJson(response);
    if (!response.ok || !data?.access_token) throw new Error(data?.message || data?.error || "activation_login_failed");
    return data;
  }

  return {
    async activatePasswordUser(user, password) {
      const authUserId = await createOrUpdateAuthUser(user, password);
      const profile = await upsertAppUser(user, authUserId);
      const auth = await signIn(user.email, password);
      return {
        auth,
        user: {
          authUserId,
          appUserId: profile?.id || "",
          mustChangePassword: profile?.must_change_password === true
        }
      };
    }
  };
}

export function createWorkerActivationHandler({
  driver = null,
  passwordActivationClient = null,
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now
} = {}) {
  const backendDriver = driver || createDefaultDriver(env, fetchImpl);
  const passwordClient = passwordActivationClient || createSupabasePasswordActivationClient(env, fetchImpl);

  return async function workerActivationHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "POST") {
      res.setHeader("allow", "POST");
      return json(res, 405, { error: "method_not_allowed" });
    }
    if (!backendDriver) return json(res, 503, { error: "activation_backend_not_configured" });

    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }

    const token = String(body?.token || "").trim();
    const action = body?.action === "activate" ? "activate" : "validate";
    if (token.length < 8 || token.length > 256) return json(res, 400, { error: "activation_token_invalid" });

    const record = await findActivationRecord(backendDriver, token);
    if (!record) return json(res, 404, { error: "activation_link_invalid" });

    if (action === "validate") {
      return json(res, 200, { ok: true, user: publicActivationUser(record.user) });
    }

    const role = record.user?.role || "worker";
    const pin = String(body?.pin || "").trim();
    const password = String(body?.password || "").trim();
    if (isPinActivationRole(role) && pin.length < 4) return json(res, 400, { error: "pin_too_short" });
    if (isPasswordActivationRole(role) && password.length < 6) return json(res, 400, { error: "password_too_short" });
    if (isPasswordActivationRole(role) && !normalizeEmail(record.user?.email)) return json(res, 400, { error: "email_required" });

    let passwordActivation = null;
    if (isPasswordActivationRole(role) && passwordClient) {
      try {
        passwordActivation = await passwordClient.activatePasswordUser(record.user, password);
      } catch (error) {
        return json(res, 502, { error: error?.message || "password_activation_failed" });
      }
    }

    const updated = {
      ...record.user,
      pin: isPinActivationRole(role) ? pin : "",
      password: isPasswordActivationRole(role) && !passwordActivation ? password : "",
      authUserId: passwordActivation?.user?.authUserId || record.user.authUserId || "",
      activationToken: "",
      activationStatus: "activated",
      activatedAt: now()
    };
    const key = record.key || `user:${updated.id}`;
    await backendDriver.set(key, JSON.stringify(updated), true);
    return json(res, 200, {
      ok: true,
      user: {
        ...publicActivatedSession(updated),
        authUserId: updated.authUserId || "",
        mustChangePassword: passwordActivation?.user?.mustChangePassword === true
      },
      auth: passwordActivation?.auth || null
    });
  };
}

export default createWorkerActivationHandler();
