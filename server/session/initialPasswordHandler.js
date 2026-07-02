import { createSupabaseKvDriverFromEnv } from "../kv/supabaseDriver.js";
import { createUpstashKvDriverFromEnv } from "../kv/upstashDriver.js";
import { signCmmsSessionToken } from "./cmmsSessionToken.js";
import { cookieAuthPayload, setAuthCookies } from "./authCookie.js";

const PIN_ROLES = new Set(["worker", "cleaner"]);
const PASSWORD_ROLES = new Set(["admin", "user"]);

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

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeIdentifier = (value) => String(value || "").trim();
const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

function createDefaultDriver(env, fetchImpl) {
  return (env.CMMS_KV_DRIVER === "upstash" ? createUpstashKvDriverFromEnv(env, fetchImpl) : null)
    || (env.CMMS_KV_DRIVER === "supabase" ? createSupabaseKvDriverFromEnv(env, fetchImpl) : null);
}

const parseStoredUser = (record) => {
  if (!record?.value) return null;
  try {
    const user = JSON.parse(record.value);
    return user && typeof user === "object" ? { key: record.key, user } : null;
  } catch {
    return null;
  }
};

const secretKind = (role) => PASSWORD_ROLES.has(String(role || "")) ? "password" : (PIN_ROLES.has(String(role || "")) ? "pin" : "");
const hasLoginSecret = (user = {}) => secretKind(user.role) === "password"
  ? !!String(user.password || user.authUserId || "").trim()
  : !!String(user.pin || "").trim();

function publicInitialUser(user = {}) {
  return {
    name: user.name || "",
    role: user.role || "user",
    email: user.email || "",
    workerNo: user.workerNo || ""
  };
}

const publicSession = (user = {}) => ({
  id: user.id || "",
  authUserId: user.authUserId || "",
  name: user.name || "",
  role: user.role || "user",
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
  permissions: user.perms || user.permissions || {},
  mustChangePassword: user.mustChangePassword === true
});

async function findInitialPasswordRecord(driver, identifier) {
  const clean = normalizeIdentifier(identifier);
  const email = normalizeEmail(clean);
  const records = await driver.listValues("user:", true);
  return (records || [])
    .map(parseStoredUser)
    .filter(Boolean)
    .find(({ user }) => {
      if (user?.active === false || user?.status === "archived") return false;
      if (PASSWORD_ROLES.has(String(user?.role || ""))) return normalizeEmail(user.email) === email;
      if (PIN_ROLES.has(String(user?.role || ""))) return normalizeIdentifier(user.workerNo) === clean;
      return false;
    });
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

function createSupabaseInitialPasswordClient(env, fetchImpl) {
  const supabaseUrl = trimSlash(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const anonKey = String(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !fetchImpl) return null;

  const serviceHeaders = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json"
  };

  const appUserProfile = (user, authUserId) => ({
    auth_user_id: authUserId,
    role: user.role || "user",
    name: user.name || normalizeEmail(user.email),
    email: normalizeEmail(user.email),
    phone: user.phone || null,
    worker_no: (user.role === "worker" || user.role === "cleaner") ? (user.workerNo || null) : null,
    department: user.dept || null,
    departments: Array.isArray(user.depts) ? user.depts : (user.dept ? [user.dept] : []),
    permissions: user.perms || user.permissions || {},
    manager_zones: Array.isArray(user.mgrZones) ? user.mgrZones : [],
    tech_scope: user.techScope || null,
    // tech_cats is stored in KV (user:), not in app_users table — do not send
    supplier: user.supplier || null,
    active: user.active !== false,
    must_change_password: false,
    login_metadata: {
      source: "initial-password",
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
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data?.message || data?.error || "auth_user_update_failed");
      return data?.id || user.authUserId;
    }

    const response = await fetchImpl(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify(body)
    });
    const data = await responseJson(response);
    if (!response.ok) throw new Error(data?.message || data?.error || "auth_user_create_failed");
    return data?.id || data?.user?.id || "";
  }

  async function upsertAppUser(user, authUserId) {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/app_users?on_conflict=auth_user_id`, {
      method: "POST",
      headers: { ...serviceHeaders, prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(appUserProfile(user, authUserId))
    });
    const data = await responseJson(response);
    if (!response.ok) throw new Error(data?.message || data?.error || "app_user_upsert_failed");
    return Array.isArray(data) ? data[0] : data;
  }

  async function signIn(email, password) {
    const response = await fetchImpl(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "content-type": "application/json" },
      body: JSON.stringify({ email: normalizeEmail(email), password })
    });
    const data = await responseJson(response);
    if (!response.ok || !data?.access_token) throw new Error(data?.message || data?.error || "initial_password_login_failed");
    return data;
  }

  return {
    async completePasswordUser(user, password) {
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

export function createInitialPasswordHandler({
  driver = null,
  passwordClient = null,
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now
} = {}) {
  const backendDriver = driver || createDefaultDriver(env, fetchImpl);
  const supabaseClient = passwordClient || createSupabaseInitialPasswordClient(env, fetchImpl);

  return async function initialPasswordHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "POST") {
      res.setHeader("allow", "POST");
      return json(res, 405, { error: "method_not_allowed" });
    }
    if (!backendDriver) return json(res, 503, { error: "initial_password_backend_not_configured" });

    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }

    const identifier = normalizeIdentifier(body?.identifier);
    if (!identifier) return json(res, 400, { error: "identifier_required" });
    const record = await findInitialPasswordRecord(backendDriver, identifier);
    if (!record) return json(res, 404, { error: "user_not_found" });

    const kind = secretKind(record.user.role);
    if (!kind) return json(res, 400, { error: "role_not_login_capable" });
    if (body?.action === "login") {
      if (kind !== "pin") return json(res, 400, { error: "pin_login_not_supported" });
      if (!hasLoginSecret(record.user)) return json(res, 409, { error: "initial_secret_not_configured", user: publicInitialUser(record.user), auth: kind });
      const pin = String(body?.pin || "").trim();
      if (!pin || String(record.user.pin || "") !== pin) return json(res, 401, { error: "pin_login_failed" });
      const cmmsSecret = String(env.CMMS_SESSION_SECRET || "").trim();
      const tokenResult = cmmsSecret ? signCmmsSessionToken(record.user.id || record.user.workerNo || "", record.user.role, record.user.workerNo || "", cmmsSecret, now()) : null;
      if (tokenResult?.token) {
        setAuthCookies(res, { accessToken: tokenResult.token, expiresAt: tokenResult.expiresAt }, { remember: body?.remember === true, env, now: now() });
      }
      return json(res, 200, {
        ok: true,
        user: publicSession(record.user),
        auth: tokenResult?.token ? cookieAuthPayload({ expiresAt: tokenResult.expiresAt }, now()) : null,
        pinSessionToken: tokenResult?.token || null,
        pinSessionExpiresAt: tokenResult?.expiresAt || null
      });
    }
    if (hasLoginSecret(record.user)) return json(res, 409, { error: "initial_secret_already_configured", user: publicInitialUser(record.user), auth: kind });
    if (kind === "password" && !isValidEmail(record.user.email)) return json(res, 400, { error: "valid_email_required", user: publicInitialUser(record.user), auth: kind });

    if (body?.action !== "complete") {
      return json(res, 200, { ok: true, needsSetup: true, auth: kind, identifierType: kind === "password" ? "email" : "workerNo", user: publicInitialUser(record.user) });
    }

    const password = String(body?.password || "").trim();
    const pin = String(body?.pin || "").trim();
    if (kind === "password" && password.length < 6) return json(res, 400, { error: "password_too_short" });
    if (kind === "pin" && pin.length < 4) return json(res, 400, { error: "pin_too_short" });

    let passwordSetup = null;
    if (kind === "password") {
      if (!supabaseClient) return json(res, 503, { error: "initial_password_auth_not_configured" });
      try {
        passwordSetup = await supabaseClient.completePasswordUser(record.user, password);
      } catch (error) {
        return json(res, 502, { error: error?.message || "initial_password_auth_failed" });
      }
    }

    const updated = {
      ...record.user,
      password: kind === "password" && !passwordSetup ? password : "",
      pin: kind === "pin" ? pin : "",
      authUserId: passwordSetup?.user?.authUserId || record.user.authUserId || "",
      activationToken: "",
      activationStatus: "activated",
      activatedAt: now()
    };
    await backendDriver.set(record.key, JSON.stringify(updated), true);

    const completeCmmsSecret = String(env.CMMS_SESSION_SECRET || "").trim();
    const completeTokenResult = (kind === "pin" && completeCmmsSecret)
      ? signCmmsSessionToken(updated.id || updated.workerNo || "", updated.role, updated.workerNo || "", completeCmmsSecret, now())
      : null;
    if (passwordSetup?.auth) {
      setAuthCookies(res, passwordSetup.auth, { remember: body?.remember === true, env, now: now() });
    } else if (completeTokenResult?.token) {
      setAuthCookies(res, { accessToken: completeTokenResult.token, expiresAt: completeTokenResult.expiresAt }, { remember: body?.remember === true, env, now: now() });
    }

    return json(res, 200, {
      ok: true,
      user: {
        ...publicSession(updated),
        id: passwordSetup?.user?.appUserId || updated.id || "",
        authUserId: updated.authUserId || "",
        mustChangePassword: passwordSetup?.user?.mustChangePassword === true
      },
      auth: passwordSetup?.auth ? cookieAuthPayload(passwordSetup.auth, now()) : (completeTokenResult?.token ? cookieAuthPayload({ expiresAt: completeTokenResult.expiresAt }, now()) : null),
      pinSessionToken: completeTokenResult?.token || null,
      pinSessionExpiresAt: completeTokenResult?.expiresAt || null
    });
  };
}

export default createInitialPasswordHandler();
