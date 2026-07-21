import { notificationEnabledForUser, notificationSessionFromSubscription, notificationPrefsFromUser } from "./notificationAccessModel.js";

export const PUSH_SUBSCRIPTIONS_KEY = "pushSubscriptions:v1";

export function pushRuntimeReady(env = {}) {
  return Boolean(env.CMMS_PUSH_VAPID_PUBLIC_KEY && env.CMMS_PUSH_VAPID_PRIVATE_KEY && env.CMMS_PUSH_CONTACT);
}

export function normalizePushSubscription(input = {}) {
  const endpoint = String(input.endpoint || "").trim();
  const p256dh = String(input.keys?.p256dh || input.p256dh || "").trim();
  const auth = String(input.keys?.auth || input.auth || "").trim();
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, keys: { p256dh, auth } };
}

export function pushSubscriptionId(subscription = {}) {
  const endpoint = String(subscription.endpoint || "");
  if (!endpoint) return "";
  let hash = 0;
  for (let i = 0; i < endpoint.length; i += 1) {
    hash = ((hash << 5) - hash + endpoint.charCodeAt(i)) | 0;
  }
  return `push-${Math.abs(hash).toString(36)}`;
}

export function parsePushSubscriptions(raw) {
  if (!raw) return [];
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => ({
        id: String(item.id || pushSubscriptionId(item.subscription)).trim(),
        userId: String(item.userId || "").trim(),
        userName: String(item.userName || "").trim(),
        userRole: String(item.userRole || "").trim(),
        userPermissions: item.userPermissions && typeof item.userPermissions === "object" ? item.userPermissions : {},
        userCleaningAccess: item.userCleaningAccess && typeof item.userCleaningAccess === "object" ? item.userCleaningAccess : (item.userCleaningAccess === true ? true : false),
        notificationPrefs: notificationPrefsFromUser(item),
        createdAt: Number(item.createdAt || 0),
        updatedAt: Number(item.updatedAt || item.createdAt || 0),
        subscription: normalizePushSubscription(item.subscription || item)
      }))
      .filter((item) => item.id && item.userId && item.subscription);
  } catch {
    return [];
  }
}

export function upsertPushSubscription(list = [], subscription = {}, user = {}, now = Date.now()) {
  const normalized = normalizePushSubscription(subscription);
  if (!normalized || !user?.id) return { ok: false, error: "push_subscription_invalid", list };
  const id = pushSubscriptionId(normalized);
  const existing = parsePushSubscriptions(list);
  const record = {
    id,
    userId: String(user.id),
    userName: String(user.name || ""),
    userRole: String(user.role || ""),
    userPermissions: user.permissions || user.perms || {},
    userCleaningAccess: user.cleaningAccess || user.cleaning || false,
    notificationPrefs: notificationPrefsFromUser(user),
    createdAt: existing.find((item) => item.id === id)?.createdAt || now,
    updatedAt: now,
    subscription: normalized
  };
  return {
    ok: true,
    id,
    list: [record, ...existing.filter((item) => item.id !== id)].slice(0, 250)
  };
}

export function removePushSubscription(list = [], subscription = {}) {
  const normalized = normalizePushSubscription(subscription);
  const id = pushSubscriptionId(normalized || {});
  if (!id) return parsePushSubscriptions(list);
  return parsePushSubscriptions(list).filter((item) => item.id !== id);
}

const PUSH_EVENT_KINDS = new Set([
  "new",
  "upd",
  "ready",
  "confirm",
  "sla",
  "escalate",
  "task",
  "pm",
  "doc",
  "driver",
  "ppe",
  "cleaning",
  "back",
  "system"
]);

const NON_INTERRUPTING_PUSH_KINDS = new Set(["doc", "pm", "ppe"]);
const NON_INTERRUPTING_PUSH_KEY_PREFIXES = ["sh-on-", "sh-off-"];

export function pushEventInterruptsUser(input = {}) {
  const kind = PUSH_EVENT_KINDS.has(input.kind) ? input.kind : "system";
  if (NON_INTERRUPTING_PUSH_KINDS.has(kind)) return false;
  const key = String(input.dedupeKey || input.tag || input.key || "").trim();
  return !NON_INTERRUPTING_PUSH_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function normalizePushNotificationRequest(input = {}) {
  const targetUserIds = [...new Set((Array.isArray(input.targetUserIds) ? input.targetUserIds : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean))].slice(0, 50);
  const title = String(input.title || DEFAULT_COMPANY_NAME).trim().slice(0, 80);
  const body = String(input.body || "יש עדכון חדש במערכת").trim().slice(0, 180);
  const rawUrl = String(input.url || "/").trim();
  const url = rawUrl.startsWith("/") && !rawUrl.startsWith("//") ? rawUrl.slice(0, 220) : "/";
  const kind = PUSH_EVENT_KINDS.has(input.kind) ? input.kind : "system";
  const tag = String(input.tag || input.dedupeKey || `cmms-${kind}`).trim().slice(0, 80);
  if (!targetUserIds.length) return { ok: false, error: "push_targets_required" };
  if (!title || !body) return { ok: false, error: "push_payload_required" };
  return { ok: true, targetUserIds, title, body, url, kind, tag, interrupting: pushEventInterruptsUser({ ...input, kind, tag }) };
}

export function selectPushNotificationTargets(subscriptions = [], targetUserIds = [], kind = "system") {
  const allowed = new Set(targetUserIds.map((id) => String(id || "").trim()).filter(Boolean));
  const seenEndpoints = new Set();
  return parsePushSubscriptions(subscriptions)
    .filter((item) => allowed.has(item.userId))
    .filter((item) => notificationEnabledForUser({
      ...notificationSessionFromSubscription(item),
      notificationPrefs: item.notificationPrefs
    }, kind))
    .filter((item) => {
      const endpoint = item.subscription?.endpoint || "";
      if (!endpoint || seenEndpoints.has(endpoint)) return false;
      seenEndpoints.add(endpoint);
      return true;
    })
    .slice(0, 50);
}

export function pushPayload(input = {}) {
  return JSON.stringify({
    title: String(input.title || DEFAULT_COMPANY_NAME).slice(0, 80),
    body: String(input.body || "יש עדכון חדש במערכת").slice(0, 180),
    url: String(input.url || "/").slice(0, 220),
    tag: String(input.tag || "cmms-update").slice(0, 80),
    kind: PUSH_EVENT_KINDS.has(input.kind) ? input.kind : "system"
  });
}
import { DEFAULT_COMPANY_NAME } from "./brandConfigModel.js";
