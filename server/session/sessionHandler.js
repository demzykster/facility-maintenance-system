import { normalizeSupabaseAppUserProfile } from "../../src/supabaseProfileModel.js";
import { createSupabaseKvDriverFromEnv } from "../kv/supabaseDriver.js";
import { createUpstashKvDriverFromEnv } from "../kv/upstashDriver.js";
import { verifyCmmsSessionToken } from "./cmmsSessionToken.js";
import { bearerToken } from "./authCookie.js";

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

async function responseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function createDefaultDriver(env, fetchImpl) {
  return (env.CMMS_KV_DRIVER === "upstash" ? createUpstashKvDriverFromEnv(env, fetchImpl) : null)
    || (env.CMMS_KV_DRIVER === "supabase" ? createSupabaseKvDriverFromEnv(env, fetchImpl) : null);
}

const parseStoredUser = (record) => {
  if (!record?.value) return null;
  try {
    const user = JSON.parse(record.value);
    return user && typeof user === "object" ? user : null;
  } catch {
    return null;
  }
};

export function createSupabaseSessionClient({ url, anonKey, fetchImpl = globalThis.fetch } = {}) {
  if (!url || !anonKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");

  async function request(path, accessToken) {
    const response = await fetchImpl(`${root}${path}`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      }
    });
    const data = await responseJson(response);
    if (!response.ok) throw new Error(data?.message || data?.msg || data?.error_description || data?.error || `supabase_session_${response.status}`);
    return data;
  }

  return {
    async getAuthUser(accessToken) {
      const data = await request("/auth/v1/user", accessToken);
      return data?.user || data;
    },
    async getAppUserProfile(accessToken, authUserId) {
      if (!authUserId) throw new Error("auth_user_id_required");
      const query = `/rest/v1/app_users?auth_user_id=eq.${encodeURIComponent(authUserId)}&select=*`;
      const data = await request(query, accessToken);
      return Array.isArray(data) ? data[0] : data;
    }
  };
}

export function buildSessionPayload(authUser, profile) {
  if (!authUser?.id) return { ok: false, error: "auth_user_missing" };
  if (!profile) return { ok: false, error: "app_user_profile_missing" };

  const appUser = normalizeSupabaseAppUserProfile(profile);
  if (!appUser.id) return { ok: false, error: "app_user_profile_id_missing" };
  if (!appUser.authUserId) return { ok: false, error: "app_user_profile_auth_link_missing" };
  if (appUser.authUserId !== authUser.id) {
    return { ok: false, error: "app_user_profile_mismatch" };
  }
  if (!appUser.active) return { ok: false, error: "app_user_disabled" };

  return {
    ok: true,
    user: {
      id: appUser.id,
      authUserId: authUser.id,
      email: authUser.email || appUser.email || "",
      phone: appUser.phone || "",
      role: appUser.role,
      name: appUser.name,
      workerNo: appUser.workerNo,
      department: appUser.department,
      departments: appUser.departments,
      mgrZones: appUser.mgrZones,
      techScope: appUser.techScope,
      supplier: appUser.supplier,
      permissions: appUser.permissions,
      mustChangePassword: appUser.mustChangePassword
    }
  };
}

export function buildCmmsPinSessionPayload(tokenSession, storedUser) {
  if (!tokenSession?.id) return { ok: false, error: "cmms_session_missing" };
  if (!storedUser) return { ok: false, error: "cmms_user_missing" };
  if (storedUser.active === false || storedUser.status === "archived") return { ok: false, error: "app_user_disabled" };
  if (String(storedUser.id || storedUser.workerNo || "") !== tokenSession.id) return { ok: false, error: "cmms_session_mismatch" };
  if (tokenSession.workerNo && String(storedUser.workerNo || "") !== tokenSession.workerNo) return { ok: false, error: "cmms_session_mismatch" };
  if (tokenSession.role && String(storedUser.role || "") !== tokenSession.role) return { ok: false, error: "cmms_session_mismatch" };

  return {
    ok: true,
    user: {
      id: storedUser.id || storedUser.workerNo || "",
      authUserId: "",
      email: storedUser.email || "",
      phone: storedUser.phone || "",
      role: storedUser.role || "worker",
      name: storedUser.name || storedUser.workerNo || "",
      workerNo: storedUser.workerNo || "",
      department: storedUser.dept || storedUser.department || "",
      departments: Array.isArray(storedUser.depts) ? storedUser.depts : (Array.isArray(storedUser.departments) ? storedUser.departments : (storedUser.dept ? [storedUser.dept] : [])),
      mgrZones: Array.isArray(storedUser.mgrZones) ? storedUser.mgrZones : [],
      techScope: storedUser.techScope || "transport",
      supplier: storedUser.supplier || "",
      permissions: storedUser.perms || storedUser.permissions || {},
      cleaningAccess: storedUser.cleaningAccess || storedUser.cleaning || false,
      mustChangePassword: storedUser.mustChangePassword === true
    }
  };
}

export function createSessionMeHandler({
  env = process.env,
  sessionClient = null,
  driver = null,
  fetchImpl = globalThis.fetch
} = {}) {
  return async function sessionMeHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "GET") {
      res.setHeader("allow", "GET");
      return json(res, 405, { error: "method_not_allowed" });
    }

    const token = bearerToken(req);
    if (!token) return json(res, 401, { error: "access_token_required" });

    const cmmsSecret = String(env.CMMS_SESSION_SECRET || "").trim();
    const cmmsTokenSession = cmmsSecret ? verifyCmmsSessionToken(token, cmmsSecret) : null;
    if (cmmsTokenSession) {
      const backendDriver = driver || createDefaultDriver(env, fetchImpl);
      if (!backendDriver) return json(res, 503, { error: "cmms_session_backend_not_configured" });
      try {
        const records = await backendDriver.listValues("user:", true);
        const storedUser = (records || [])
          .map(parseStoredUser)
          .filter(Boolean)
          .find((user) => (
            String(user.id || user.workerNo || "") === cmmsTokenSession.id
            || (cmmsTokenSession.workerNo && String(user.workerNo || "") === cmmsTokenSession.workerNo)
          ));
        const session = buildCmmsPinSessionPayload(cmmsTokenSession, storedUser);
        if (!session.ok) return json(res, session.error === "app_user_disabled" ? 403 : 401, { error: session.error });
        return json(res, 200, session);
      } catch {
        return json(res, 401, { error: "cmms_session_lookup_failed" });
      }
    }

    const client = sessionClient || createSupabaseSessionClient({
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      fetchImpl
    });
    if (!client) return json(res, 503, { error: "supabase_session_not_configured" });

    try {
      const authUser = await client.getAuthUser(token);
      const profile = await client.getAppUserProfile(token, authUser?.id);
      const session = buildSessionPayload(authUser, profile);
      if (!session.ok) return json(res, session.error === "app_user_disabled" ? 403 : 401, { error: session.error });
      return json(res, 200, session);
    } catch {
      return json(res, 401, { error: "session_lookup_failed" });
    }
  };
}

export default createSessionMeHandler();
