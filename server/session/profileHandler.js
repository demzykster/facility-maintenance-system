import { buildSessionPayload } from "./sessionHandler.js";
import { bearerToken } from "./authCookie.js";
import { sendServerError } from "../httpErrors.js";

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

async function responseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function validateProfilePayload(body = {}) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return { ok: false, error: "email_required" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "email_invalid" };
    patch.email = email;
  }
  if (Object.prototype.hasOwnProperty.call(body, "phone")) {
    const phone = String(body.phone || "").trim();
    if (phone.length > 40) return { ok: false, error: "phone_too_long" };
    patch.phone = phone;
  }
  if (!Object.keys(patch).length) return { ok: false, error: "profile_patch_empty" };
  return { ok: true, patch };
}

export function createSupabaseProfileUpdateClient({ url, anonKey, serviceRoleKey, fetchImpl = globalThis.fetch } = {}) {
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
      const response = await fetchImpl(`${root}/rest/v1/app_users?auth_user_id=eq.${encodeURIComponent(authUserId)}&select=*`, {
        method: "GET",
        headers: authHeaders(accessToken)
      });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data?.message || data?.error || `supabase_profile_${response.status}`);
      return Array.isArray(data) ? data[0] : data;
    },
    async getAppUserProfileById(id) {
      const response = await fetchImpl(`${root}/rest/v1/app_users?id=eq.${encodeURIComponent(id)}&select=*`, {
        method: "GET",
        headers: serviceHeaders
      });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data?.message || data?.error || `supabase_profile_get_${response.status}`);
      return Array.isArray(data) ? data[0] : data;
    },
    async listAppUserProfiles() {
      const response = await fetchImpl(`${root}/rest/v1/app_users?select=*&order=name.asc`, {
        method: "GET",
        headers: serviceHeaders
      });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data?.message || data?.error || `supabase_profile_list_${response.status}`);
      return Array.isArray(data) ? data : [];
    },
    async updateAuthEmail(authUserId, email) {
      const response = await fetchImpl(`${root}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
        method: "PUT",
        headers: serviceHeaders,
        body: JSON.stringify({ email, email_confirm: true })
      });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data?.message || data?.error || `supabase_auth_email_${response.status}`);
      return data?.user || data;
    },
    async updateAppUserProfile(authUserId, patch) {
      const response = await fetchImpl(`${root}/rest/v1/app_users?auth_user_id=eq.${encodeURIComponent(authUserId)}`, {
        method: "PATCH",
        headers: { ...serviceHeaders, prefer: "return=representation" },
        body: JSON.stringify(patch)
      });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data?.message || data?.error || `supabase_profile_update_${response.status}`);
      return Array.isArray(data) ? data[0] : data;
    }
  };
}

export function createProfileHandler({
  env = process.env,
  profileClient = null,
  fetchImpl = globalThis.fetch
} = {}) {
  return async function profileHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "PATCH") {
      res.setHeader("allow", "PATCH");
      return json(res, 405, { error: "method_not_allowed" });
    }

    const token = bearerToken(req);
    if (!token) return json(res, 401, { error: "access_token_required" });

    const client = profileClient || createSupabaseProfileUpdateClient({
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      fetchImpl
    });
    if (!client) return json(res, 503, { error: "supabase_profile_not_configured" });

    try {
      const validated = validateProfilePayload(await readBody(req));
      if (!validated.ok) return json(res, 400, { error: validated.error });

      const authUser = await client.getAuthUser(token);
      const profile = await client.getAppUserProfile(token, authUser?.id);
      const current = buildSessionPayload(authUser, profile);
      if (!current.ok) return json(res, current.error === "app_user_disabled" ? 403 : 401, { error: current.error });

      const appPatch = {};
      let updatedAuthUser = authUser;
      if (validated.patch.email && validated.patch.email !== current.user.email) {
        updatedAuthUser = await client.updateAuthEmail(authUser.id, validated.patch.email);
        appPatch.email = validated.patch.email;
      }
      if (Object.prototype.hasOwnProperty.call(validated.patch, "phone")) appPatch.phone = validated.patch.phone;
      const updatedProfile = Object.keys(appPatch).length ? await client.updateAppUserProfile(authUser.id, appPatch) : profile;
      const session = buildSessionPayload(updatedAuthUser, updatedProfile);
      if (!session.ok) return sendServerError(req, res, new Error(session.error), {
        code: "profile_update_session_error",
        route: "/api/session/profile"
      });
      return json(res, 200, session);
    } catch (error) {
      return sendServerError(req, res, error, { code: "profile_update_failed", route: "/api/session/profile" });
    }
  };
}

export default createProfileHandler();
