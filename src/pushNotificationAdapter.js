import { createProductionAuthStore } from "./productionLoginAdapter.js";

const authStore = createProductionAuthStore();

const readJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const base64UrlToUint8Array = (base64Url = "") => {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = `${base64Url}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
};

export function pushSupported() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export async function registerCmmsServiceWorker() {
  if (!pushSupported()) return { ok: false, error: "push_not_supported" };
  const registration = await navigator.serviceWorker.register("/cmms-sw.js");
  return { ok: true, registration };
}

export async function fetchPushConfig({ endpoint = "/api/push", fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") return { ok: false, error: "fetch_unavailable" };
  const response = await fetchImpl(endpoint);
  const data = await readJson(response);
  if (!response.ok || data?.ok !== true) return { ok: false, error: data?.error || "push_config_failed" };
  return data;
}

export async function subscribeToPhonePush({
  endpoint = "/api/push",
  fetchImpl = globalThis.fetch,
  getAccessToken = () => authStore.get()?.accessToken || ""
} = {}) {
  if (!pushSupported()) return { ok: false, error: "push_not_supported" };
  const accessToken = getAccessToken();
  if (!accessToken) return { ok: false, error: "access_token_required" };
  const config = await fetchPushConfig({ endpoint, fetchImpl });
  if (!config.ok) return config;
  if (!config.enabled || !config.publicKey) return { ok: false, error: "push_server_disabled" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "notification_permission_denied" };

  const { registration } = await registerCmmsServiceWorker();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(config.publicKey)
  });

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: "subscribe", subscription: subscription.toJSON() })
  });
  const data = await readJson(response);
  if (!response.ok || data?.ok !== true) return { ok: false, error: data?.error || "push_subscribe_failed" };
  return { ok: true, id: data.id };
}

export async function sendTestPhonePush({
  endpoint = "/api/push",
  fetchImpl = globalThis.fetch,
  getAccessToken = () => authStore.get()?.accessToken || ""
} = {}) {
  const accessToken = getAccessToken();
  if (!accessToken) return { ok: false, error: "access_token_required" };
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: "test" })
  });
  const data = await readJson(response);
  if (!response.ok || data?.ok !== true) return { ok: false, error: data?.error || "push_test_failed" };
  return { ok: true, sent: data.sent || 0 };
}

export async function sendPhoneNotification({
  event,
  endpoint = "/api/push",
  fetchImpl = globalThis.fetch,
  getAccessToken = () => authStore.get()?.accessToken || ""
} = {}) {
  const accessToken = getAccessToken();
  if (!accessToken) return { ok: false, error: "access_token_required" };
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: "notify", event })
  });
  const data = await readJson(response);
  if (!response.ok || data?.ok !== true) return { ok: false, error: data?.error || "push_notify_failed" };
  return { ok: true, sent: data.sent || 0, targets: data.targets || 0 };
}
