import webPush from "web-push";
import { createSupabaseSessionClient, buildSessionPayload } from "../session/sessionHandler.js";
import { createSupabaseKvDriverFromEnv } from "../kv/supabaseDriver.js";
import { sendJson, sendServerError } from "../httpErrors.js";
import {
  parsePushSubscriptions,
  PUSH_SUBSCRIPTIONS_KEY,
  pushPayload,
  pushRuntimeReady,
  removePushSubscription,
  upsertPushSubscription
} from "../../src/pushNotificationModel.js";

const getHeader = (headers = {}, name) => {
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (direct) return Array.isArray(direct) ? direct[0] : direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match ? (Array.isArray(match[1]) ? match[1][0] : match[1]) : "";
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
    return { ok: true, user: session.user };
  } catch {
    return { ok: false, status: 401, error: "supabase_session_failed" };
  }
}

export function createPushHandler({
  driver = null,
  push = webPush,
  env = process.env,
  fetchImpl = globalThis.fetch,
  sessionClient = null
} = {}) {
  const backendDriver = driver
    || (env.CMMS_KV_DRIVER === "supabase" ? createSupabaseKvDriverFromEnv(env, fetchImpl) : null);
  const enabled = pushRuntimeReady(env);

  if (enabled && push?.setVapidDetails) {
    push.setVapidDetails(
      env.CMMS_PUSH_CONTACT,
      env.CMMS_PUSH_VAPID_PUBLIC_KEY,
      env.CMMS_PUSH_VAPID_PRIVATE_KEY
    );
  }

  return async function pushHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();

    if (method === "GET") {
      return sendJson(res, 200, {
        ok: true,
        enabled,
        publicKey: enabled ? env.CMMS_PUSH_VAPID_PUBLIC_KEY : ""
      });
    }

    if (method !== "POST") {
      res.setHeader("allow", "GET, POST");
      return sendJson(res, 405, { error: "method_not_allowed" });
    }

    if (!enabled) return sendJson(res, 503, { error: "push_not_configured" });
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });
    if (!backendDriver) return sendJson(res, 503, { error: "push_storage_not_configured" });

    try {
      const body = await readBody(req);
      const action = String(body.action || "subscribe");
      const current = parsePushSubscriptions(await backendDriver.get(PUSH_SUBSCRIPTIONS_KEY, true));

      if (action === "subscribe") {
        const result = upsertPushSubscription(current, body.subscription, auth.user);
        if (!result.ok) return sendJson(res, 400, { error: result.error });
        await backendDriver.set(PUSH_SUBSCRIPTIONS_KEY, JSON.stringify(result.list), true);
        return sendJson(res, 200, { ok: true, id: result.id });
      }

      if (action === "unsubscribe") {
        const list = removePushSubscription(current, body.subscription);
        await backendDriver.set(PUSH_SUBSCRIPTIONS_KEY, JSON.stringify(list), true);
        return sendJson(res, 200, { ok: true });
      }

      if (action === "test") {
        const targets = current.filter((item) => item.userId === auth.user.id);
        let sent = 0;
        for (const target of targets) {
          await push.sendNotification(target.subscription, pushPayload({
            title: "CMMS CDSL",
            body: "התראות לטלפון הופעלו",
            url: "/",
            tag: "cmms-push-test"
          }));
          sent += 1;
        }
        return sendJson(res, 200, { ok: true, sent });
      }

      return sendJson(res, 400, { error: "push_action_unknown" });
    } catch (error) {
      return sendServerError(req, res, error, { code: "push_api_error", route: "/api/push" });
    }
  };
}

export default createPushHandler();
