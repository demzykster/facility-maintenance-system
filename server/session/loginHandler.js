import { buildSessionPayload, createSupabaseSessionClient } from "./sessionHandler.js";
import { cookieAuthPayload, setAuthCookies } from "./authCookie.js";

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

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

export function createSessionLoginHandler({
  env = process.env,
  sessionClient = null,
  fetchImpl = globalThis.fetch,
  now = Date.now
} = {}) {
  return async function sessionLoginHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "POST") {
      res.setHeader("allow", "POST");
      return json(res, 405, { error: "method_not_allowed" });
    }

    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }

    const email = normalizeEmail(body?.email);
    const password = String(body?.password || "");
    if (!email || !password) return json(res, 400, { error: "email_and_password_required" });

    const supabaseUrl = trimSlash(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
    const anonKey = String(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "").trim();
    if (!supabaseUrl || !anonKey || !fetchImpl) return json(res, 503, { error: "supabase_login_not_configured" });

    try {
      const authResponse = await fetchImpl(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          "content-type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });
      const auth = await responseJson(authResponse);
      if (!authResponse.ok || !auth?.access_token) {
        return json(res, 401, { error: auth?.message || auth?.msg || auth?.error_description || auth?.error || "supabase_login_failed" });
      }

      const client = sessionClient || createSupabaseSessionClient({ url: supabaseUrl, anonKey, fetchImpl });
      if (!client) return json(res, 503, { error: "supabase_session_not_configured" });

      const authUser = await client.getAuthUser(auth.access_token);
      const profile = await client.getAppUserProfile(auth.access_token, authUser?.id);
      const session = buildSessionPayload(authUser, profile);
      if (!session.ok) return json(res, session.error === "app_user_disabled" ? 403 : 401, { error: session.error });

      setAuthCookies(res, auth, { remember: body?.remember === true, env, now: now() });
      return json(res, 200, {
        ...session,
        auth: cookieAuthPayload(auth, now())
      });
    } catch {
      return json(res, 401, { error: "session_login_failed" });
    }
  };
}

export default createSessionLoginHandler();
