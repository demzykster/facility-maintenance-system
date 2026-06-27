import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { createSupabaseFileDriverFromEnv } from "./supabaseFileDriver.js";

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

const normalizePath = (value = "") => {
  const path = String(Array.isArray(value) ? value.join("/") : value).trim().replace(/^\/+/, "");
  if (!path || path.includes("..") || path.includes("//")) return "";
  return path;
};

const bufferFromBody = (body = {}) => {
  const raw = String(body.data || body.value || "");
  const match = raw.match(/^data:([^;,]+);base64,(.+)$/i);
  const contentType = body.contentType || (match ? match[1] : "application/octet-stream");
  const base64 = match ? match[2] : raw;
  if (!base64) return null;
  return {
    contentType,
    buffer: Buffer.from(base64, "base64")
  };
};

async function authorize(req, env, fetchImpl, sessionClient) {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: "supabase_access_token_required" };
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
  } catch (error) {
    return { ok: false, status: 401, error: error?.message || "supabase_session_failed" };
  }
}

export function createFileApiHandler({ driver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDriver = driver
    || (env.CMMS_FILE_DRIVER === "supabase" ? createSupabaseFileDriverFromEnv(env, fetchImpl) : null);

  return async function fileApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    if (!backendDriver) return json(res, 503, { error: "file_storage_not_configured" });

    try {
      const method = String(req.method || "GET").toUpperCase();
      const path = normalizePath(req.query?.path);
      if (!path) return json(res, 400, { error: "path_required" });

      if (method === "GET") {
        const file = await backendDriver.download(path, auth.user);
        return json(res, 200, {
          path,
          contentType: file.contentType,
          data: file.buffer.toString("base64")
        });
      }
      if (method === "POST" || method === "PUT") {
        const file = bufferFromBody(await readBody(req));
        if (!file || !file.buffer.length) return json(res, 400, { error: "file_data_required" });
        await backendDriver.upload(path, file.buffer, file.contentType, auth.user);
        return json(res, 200, { ok: true, path, contentType: file.contentType });
      }
      if (method === "DELETE") {
        await backendDriver.delete(path, auth.user);
        return json(res, 200, { ok: true, path });
      }

      res.setHeader("allow", "GET, POST, PUT, DELETE");
      return json(res, 405, { error: "method_not_allowed" });
    } catch (error) {
      return json(res, 500, { error: error?.message || "file_storage_error" });
    }
  };
}

export default createFileApiHandler();
