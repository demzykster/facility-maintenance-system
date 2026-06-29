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

export async function fetchSystemErrorLogs({
  endpoint = "/api/system-errors",
  limit = 50,
  fetchImpl = globalThis.fetch,
  getAccessToken = () => authStore.get()?.accessToken || ""
} = {}) {
  if (typeof fetchImpl !== "function") return { ok: false, error: "fetch_unavailable", errors: [] };
  const accessToken = typeof getAccessToken === "function" ? getAccessToken() : "";
  if (!accessToken) return { ok: false, error: "access_token_required", errors: [] };

  const url = `${endpoint}?limit=${encodeURIComponent(String(limit))}`;
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok || data?.ok !== true) {
    return { ok: false, error: data?.error || "system_errors_failed", errors: [] };
  }
  return { ok: true, errors: Array.isArray(data.errors) ? data.errors : [] };
}
