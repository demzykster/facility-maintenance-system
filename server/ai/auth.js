import { bearerToken } from "../session/authCookie.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import {
  buildCmmsPinSessionPayload,
  buildSessionPayload,
  createSupabaseCmmsPinSessionClient,
  createSupabaseSessionClient
} from "../session/sessionHandler.js";

export async function authorizeAiRequest(req, env = {}, fetchImpl = globalThis.fetch, sessionClient = null, pinSessionClient = null) {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: "access_token_required" };

  const cmmsSecret = String(env.CMMS_SESSION_SECRET || "").trim();
  const cmmsTokenSession = cmmsSecret ? verifyCmmsSessionToken(token, cmmsSecret) : null;
  if (cmmsTokenSession) {
    const client = pinSessionClient || createSupabaseCmmsPinSessionClient({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      fetchImpl
    });
    if (!client) return { ok: false, status: 503, error: "cmms_session_backend_not_configured" };
    try {
      const appUser = await client.findPinSessionUser(cmmsTokenSession);
      const session = buildCmmsPinSessionPayload(cmmsTokenSession, appUser);
      if (!session.ok) return { ok: false, status: session.error === "app_user_disabled" ? 403 : 401, error: session.error };
      if (session.user.mustChangePassword) return { ok: false, status: 403, error: "password_change_required" };
      return { ok: true, user: session.user };
    } catch {
      return { ok: false, status: 401, error: "cmms_session_lookup_failed" };
    }
  }

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
  } catch {
    return { ok: false, status: 401, error: "session_lookup_failed" };
  }
}
