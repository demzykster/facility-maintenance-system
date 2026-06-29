import { createProductionAuthStore } from "./productionLoginAdapter.js";

const authStore = createProductionAuthStore();

const safePath = () => {
  try {
    return `${window.location.origin}${window.location.pathname}`;
  } catch {
    return "";
  }
};

export async function reportClientError(event = {}, {
  endpoint = "/api/client-errors",
  fetchImpl = globalThis.fetch,
  getAccessToken = () => authStore.get()?.accessToken || ""
} = {}) {
  if (typeof fetchImpl !== "function") return false;
  const accessToken = typeof getAccessToken === "function" ? getAccessToken() : "";
  if (!accessToken) return false;

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        kind: event.kind || "client_error",
        message: event.message || "",
        operation: event.operation || "",
        key: event.key || "",
        shared: event.shared === true,
        path: event.path || safePath(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        metadata: event.metadata || {}
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}
