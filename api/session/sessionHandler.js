import { normalizeSupabaseAppUserProfile } from "../../src/supabaseProfileModel.js";

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const getHeader = (headers = {}, name) => {
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (direct) return direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match ? match[1] : "";
};

const bearerToken = (req) => {
  const value = String(getHeader(req.headers, "authorization") || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
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
      role: appUser.role,
      name: appUser.name,
      workerNo: appUser.workerNo,
      department: appUser.department,
      departments: appUser.departments,
      permissions: appUser.permissions,
      mustChangePassword: appUser.mustChangePassword
    }
  };
}

export function createSessionMeHandler({
  env = process.env,
  sessionClient = null,
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
    } catch (error) {
      return json(res, 401, { error: error?.message || "session_lookup_failed" });
    }
  };
}

export default createSessionMeHandler();
