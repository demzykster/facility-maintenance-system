import webPush from "web-push";
import { createSupabaseSessionClient, buildSessionPayload } from "../session/sessionHandler.js";
import { bearerToken } from "../session/authCookie.js";
import { createSupabaseKvDriverFromEnv } from "../kv/supabaseDriver.js";
import { sendJson, sendServerError } from "../httpErrors.js";
import { createSupabasePushSubscriptionDriverFromEnv } from "./supabasePushSubscriptionDriver.js";
import {
  parsePushSubscriptions,
  PUSH_SUBSCRIPTIONS_KEY,
  pushPayload,
  pushRuntimeReady,
  normalizePushNotificationRequest,
  removePushSubscription,
  selectPushNotificationTargets,
  upsertPushSubscription
} from "../../src/pushNotificationModel.js";
import { retiredKvWriteKey } from "../../src/retiredKvWriteModel.js";

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
};

const parseStoredUser = (raw) => {
  if (!raw) return null;
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
};

async function enrichSubscriptionsWithUsers(driver, subscriptions = []) {
  const userIds = [...new Set(subscriptions.map((item) => item.userId).filter(Boolean))];
  if (!driver?.get || !userIds.length) return subscriptions;
  const usersById = new Map();
  await Promise.all(userIds.map(async (userId) => {
    const stored = parseStoredUser(await driver.get(`user:${userId}`, true));
    if (stored) usersById.set(userId, stored);
  }));
  return subscriptions.map((item) => {
    const user = usersById.get(item.userId);
    if (!user) return item;
    return {
      ...item,
      userRole: user.role || item.userRole,
      userPermissions: user.permissions || user.perms || item.userPermissions,
      notificationPrefs: user.notificationPrefs || user.notificationPreferences || user.notifyPrefs || item.notificationPrefs
    };
  });
}

function createKvPushSubscriptionStore(driver) {
  if (!driver?.get || !driver?.set) return null;
  return {
    async list() {
      return parsePushSubscriptions(await driver.get(PUSH_SUBSCRIPTIONS_KEY, true));
    },
    async upsert(record) {
      const current = parsePushSubscriptions(await driver.get(PUSH_SUBSCRIPTIONS_KEY, true));
      const next = [record, ...current.filter((item) => item.id !== record.id)].slice(0, 250);
      await driver.set(PUSH_SUBSCRIPTIONS_KEY, JSON.stringify(next), true);
      return next;
    },
    async deleteMany(ids = []) {
      const removeIds = new Set(ids.map(String));
      const current = parsePushSubscriptions(await driver.get(PUSH_SUBSCRIPTIONS_KEY, true));
      const next = current.filter((item) => !removeIds.has(item.id));
      await driver.set(PUSH_SUBSCRIPTIONS_KEY, JSON.stringify(next), true);
      return next;
    },
    async mirrorAll(list = []) {
      await driver.set(PUSH_SUBSCRIPTIONS_KEY, JSON.stringify(parsePushSubscriptions(list)), true);
    }
  };
}

export function createNormalizedPushSubscriptionStore({ driver, mirrorDriver = null } = {}) {
  if (!driver?.list || !driver?.upsert || !driver?.delete) return null;
  const mirrorStore = createKvPushSubscriptionStore(mirrorDriver);
  return {
    async list() {
      const normalized = await driver.list();
      if (normalized.length || !mirrorStore) return normalized;
      return mirrorStore.list();
    },
    async upsert(record) {
      await driver.upsert(record);
      const next = await driver.list();
      await mirrorStore?.mirrorAll(next);
      return next;
    },
    async deleteMany(ids = []) {
      for (const id of ids) await driver.delete(id);
      const next = await driver.list();
      await mirrorStore?.mirrorAll(next);
      return next;
    },
    async mirrorAll(list = []) {
      await mirrorStore?.mirrorAll(list);
    }
  };
}

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
  subscriptionStore = null,
  push = webPush,
  env = process.env,
  fetchImpl = globalThis.fetch,
  sessionClient = null
} = {}) {
  const backendKvDriver = driver
    || (env.CMMS_KV_DRIVER === "supabase" ? createSupabaseKvDriverFromEnv(env, fetchImpl) : null);
  const retiredPushMirror = retiredKvWriteKey(PUSH_SUBSCRIPTIONS_KEY, {
    appMode: env.VITE_CMMS_APP_MODE,
    storageProvider: env.VITE_CMMS_STORAGE_PROVIDER
  });
  const backendSubscriptionStore = subscriptionStore
    || (driver ? createKvPushSubscriptionStore(driver) : null)
    || createNormalizedPushSubscriptionStore({
      driver: createSupabasePushSubscriptionDriverFromEnv(env, fetchImpl),
      mirrorDriver: retiredPushMirror ? null : backendKvDriver
    })
    || createKvPushSubscriptionStore(backendKvDriver);
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
    if (!backendSubscriptionStore) return sendJson(res, 503, { error: "push_storage_not_configured" });

    try {
      const body = await readBody(req);
      const action = String(body.action || "subscribe");
      const current = await backendSubscriptionStore.list();

      if (action === "subscribe") {
        const result = upsertPushSubscription(current, body.subscription, auth.user);
        if (!result.ok) return sendJson(res, 400, { error: result.error });
        const record = result.list.find((item) => item.id === result.id);
        await backendSubscriptionStore.upsert(record);
        return sendJson(res, 200, { ok: true, id: result.id });
      }

      if (action === "unsubscribe") {
        const list = removePushSubscription(current, body.subscription);
        const remaining = new Set(list.map((item) => item.id));
        const removedIds = current.filter((item) => !remaining.has(item.id)).map((item) => item.id);
        await backendSubscriptionStore.deleteMany(removedIds);
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

      if (action === "notify") {
        const normalized = normalizePushNotificationRequest(body.event || body);
        if (!normalized.ok) return sendJson(res, 400, { error: normalized.error });
        const subscriptions = await enrichSubscriptionsWithUsers(backendKvDriver, current);
        const targets = selectPushNotificationTargets(subscriptions, normalized.targetUserIds, normalized.kind);
        let sent = 0;
        for (const target of targets) {
          await push.sendNotification(target.subscription, pushPayload({
            title: normalized.title,
            body: normalized.body,
            url: normalized.url,
            tag: normalized.tag
          }));
          sent += 1;
        }
        return sendJson(res, 200, { ok: true, sent, targets: targets.length });
      }

      return sendJson(res, 400, { error: "push_action_unknown" });
    } catch (error) {
      return sendServerError(req, res, error, { code: "push_api_error", route: "/api/push" });
    }
  };
}

export default createPushHandler();
