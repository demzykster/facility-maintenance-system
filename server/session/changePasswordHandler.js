import { buildSessionPayload } from "./sessionHandler.js";
import { sendServerError } from "../httpErrors.js";

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

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
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

export function validatePasswordChangePayload(body = {}) {
  const newPassword = String(body.newPassword || body.password || "");
  if (newPassword.length < 6) return { ok: false, error: "new_password_min_6_chars" };
  return { ok: true, newPassword };
}

export function createSupabasePasswordChangeClient({ url, anonKey, serviceRoleKey, fetchImpl = globalThis.fetch } = {}) {
  if (!url || !anonKey || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const authHeaders = (accessToken) => ({ apikey: anonKey, authorization: `Bearer ${accessToken}`, "content-type": "application/json" });
  const serviceHeaders = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json" };

  return {
    async getAuthUser(accessToken) {
      const response = await fetchImpl(`${root}/auth/v1/user`, { method: "GET", headers: authHeaders(accessToken) });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data?.message || data?.error || `supabase_auth_${response.status}`);
      return data?.user || data;
    },
    async getAppUserProfile(accessToken, authUserId) {
      const query = `/rest/v1/app_users?auth_user_id=eq.${encodeURIComponent(authUserId)}&select=*`;
      const response = await fetchImpl(`${root}${query}`, { method: "GET", headers: authHeaders(accessToken) });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data?.message || data?.error || `supabase_profile_${response.status}`);
      return Array.isArray(data) ? data[0] : data;
    },
    async updateAuthPassword(accessToken, newPassword) {
      const response = await fetchImpl(`${root}/auth/v1/user`, {
        method: "PUT",
        headers: authHeaders(accessToken),
        body: JSON.stringify({ password: newPassword })
      });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data?.message || data?.error || `supabase_password_${response.status}`);
      return data;
    },
    async clearMustChangePassword(authUserId) {
      const response = await fetchImpl(`${root}/rest/v1/app_users?auth_user_id=eq.${encodeURIComponent(authUserId)}`, {
        method: "PATCH",
        headers: { ...serviceHeaders, prefer: "return=representation" },
        body: JSON.stringify({ must_change_password: false })
      });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data?.message || data?.error || `supabase_profile_update_${response.status}`);
      return Array.isArray(data) ? data[0] : data;
    }
  };
}

export function createChangePasswordHandler({
  env = process.env,
  passwordClient = null,
  fetchImpl = globalThis.fetch
} = {}) {
  return async function changePasswordHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "POST") {
      res.setHeader("allow", "POST");
      return json(res, 405, { error: "method_not_allowed" });
    }

    const token = bearerToken(req);
    if (!token) return json(res, 401, { error: "access_token_required" });

    const client = passwordClient || createSupabasePasswordChangeClient({
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      fetchImpl
    });
    if (!client) return json(res, 503, { error: "supabase_password_change_not_configured" });

    try {
      const validated = validatePasswordChangePayload(await readBody(req));
      if (!validated.ok) return json(res, 400, { error: validated.error });

      const authUser = await client.getAuthUser(token);
      const profile = await client.getAppUserProfile(token, authUser?.id);
      const current = buildSessionPayload(authUser, profile);
      if (!current.ok) return json(res, 401, { error: current.error });
      if (current.user.mustChangePassword !== true) return json(res, 409, { error: "password_change_not_required" });

      await client.updateAuthPassword(token, validated.newPassword);
      const updatedProfile = await client.clearMustChangePassword(authUser.id);
      const session = buildSessionPayload(authUser, updatedProfile);
      if (!session.ok) return sendServerError(req, res, new Error(session.error), {
        code: "password_change_session_error",
        route: "/api/session/change-password"
      });
      return json(res, 200, session);
    } catch (error) {
      return sendServerError(req, res, error, { code: "password_change_failed", route: "/api/session/change-password" });
    }
  };
}

export default createChangePasswordHandler();
