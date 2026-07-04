import { buildSessionPayload } from "./sessionHandler.js";
import { createSupabaseProfileUpdateClient } from "./profileHandler.js";
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

const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const normalizeString = (value) => String(value || "").trim();
const normalizeEmail = (value) => normalizeString(value).toLowerCase();
const normalizeArray = (value) => Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];

const ALLOWED_PATCH_FIELDS = new Set([
  "name",
  "role",
  "active",
  "email",
  "phone",
  "department",
  "departments",
  "permissions",
  "manager_zones",
  "tech_scope",
  "supplier"
]);

export function validateAdminProfilePayload(body = {}) {
  const authUserId = normalizeString(body.authUserId);
  if (!authUserId) return { ok: false, error: "auth_user_id_required" };
  if (!isPlainObject(body.patch)) return { ok: false, error: "profile_patch_required" };

  const patch = {};
  for (const [field, value] of Object.entries(body.patch)) {
    if (!ALLOWED_PATCH_FIELDS.has(field)) continue;
    if (field === "email") {
      const email = normalizeEmail(value);
      if (!email) {
        patch.email = null;
      } else {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "email_invalid" };
        patch.email = email;
      }
    } else if (field === "name" || field === "phone" || field === "department" || field === "tech_scope" || field === "supplier") {
      patch[field] = normalizeString(value) || null;
    } else if (field === "role") {
      const role = normalizeString(value) || "user";
      if (!["admin", "user", "tech", "worker"].includes(role)) return { ok: false, error: "role_invalid" };
      patch.role = role;
    } else if (field === "active") {
      patch.active = value !== false;
    } else if (field === "departments" || field === "manager_zones") {
      patch[field] = normalizeArray(value);
    } else if (field === "permissions") {
      patch.permissions = isPlainObject(value) ? value : {};
    }
  }

  if (!Object.keys(patch).length) return { ok: false, error: "profile_patch_empty" };
  return { ok: true, authUserId, patch };
}

export function createAdminProfileHandler({
  env = process.env,
  profileClient = null,
  fetchImpl = globalThis.fetch
} = {}) {
  return async function adminProfileHandler(req, res) {
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
      const validated = validateAdminProfilePayload(await readBody(req));
      if (!validated.ok) return json(res, 400, { error: validated.error });

      const actorAuthUser = await client.getAuthUser(token);
      const actorProfile = await client.getAppUserProfile(token, actorAuthUser?.id);
      const actorSession = buildSessionPayload(actorAuthUser, actorProfile);
      if (!actorSession.ok) return json(res, actorSession.error === "app_user_disabled" ? 403 : 401, { error: actorSession.error });
      if (actorSession.user.role !== "admin") return json(res, 403, { error: "admin_required" });

      if (validated.patch.email) {
        await client.updateAuthEmail(validated.authUserId, validated.patch.email);
      }
      const updatedProfile = await client.updateAppUserProfile(validated.authUserId, validated.patch);
      return json(res, 200, { ok: true, profile: updatedProfile });
    } catch (error) {
      return sendServerError(req, res, error, { code: "admin_profile_update_failed", route: "/api/session/admin-profile" });
    }
  };
}

export default createAdminProfileHandler();
