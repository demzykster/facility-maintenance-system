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

const cleanPart = (value, fallback = "unknown") => {
  const text = String(value || "").trim();
  return text || fallback;
};

export function systemErrorGroupKey(error = {}) {
  return [
    cleanPart(error.kind, "system_error"),
    cleanPart(error.operation),
    cleanPart(error.key),
    cleanPart(error.path)
  ].join("|");
}

export function groupSystemErrorLogs(errors = []) {
  const groupsByKey = new Map();
  (Array.isArray(errors) ? errors : []).forEach((error) => {
    const key = systemErrorGroupKey(error);
    const existing = groupsByKey.get(key) || {
      key,
      kind: error.kind || "",
      operation: error.operation || "",
      recordKey: error.key || "",
      path: error.path || "",
      latestAt: 0,
      count: 0,
      latest: null,
      items: []
    };
    existing.count += 1;
    existing.items.push(error);
    const at = Number(error.at || 0);
    if (!existing.latest || at >= existing.latestAt) {
      existing.latestAt = at;
      existing.latest = error;
      existing.actorName = error.actorName || "";
      existing.actorRole = error.actorRole || "";
      existing.error = error.error || "";
      existing.errorId = error.errorId || "";
      existing.online = error.online;
      existing.visibilityState = error.visibilityState || "";
      existing.focused = error.focused;
      existing.viewport = error.viewport || "";
      existing.summary = error.summary || "";
    }
    groupsByKey.set(key, existing);
  });
  return Array.from(groupsByKey.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => Number(b.at || 0) - Number(a.at || 0))
    }))
    .sort((a, b) => Number(b.latestAt || 0) - Number(a.latestAt || 0));
}
