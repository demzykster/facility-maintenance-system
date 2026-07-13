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
  type = "",
  fetchImpl = globalThis.fetch,
  getAccessToken = () => authStore.get()?.accessToken || ""
} = {}) {
  if (typeof fetchImpl !== "function") return { ok: false, error: "fetch_unavailable", errors: [] };
  const accessToken = typeof getAccessToken === "function" ? getAccessToken() : "";
  const hasCookieSession = authStore.get()?.cookieSession === true;
  if (!accessToken && !hasCookieSession) return { ok: false, error: "access_token_required", errors: [] };

  const params = new URLSearchParams({ limit: String(limit) });
  if (type) params.set("type", type);
  const url = `${endpoint}?${params.toString()}`;
  const response = await fetchImpl(url, {
    method: "GET",
    credentials: "include",
    headers: { ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) }
  });
  const data = await readJson(response);
  if (!response.ok || data?.ok !== true) {
    return { ok: false, error: data?.error || "system_errors_failed", errors: [] };
  }
  return {
    ok: true,
    errors: Array.isArray(data.errors) ? data.errors : [],
    aiAssist: Array.isArray(data.aiAssist) ? data.aiAssist : []
  };
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

export function aiAssistGroupKey(event = {}) {
  return [
    cleanPart(event.providerStatus, "unknown_status"),
    cleanPart(event.module, "unknown_module"),
    cleanPart((event.actionTypes || [])[0] || event.action || "no_action"),
    event.languageMismatch ? "language_mismatch" : "language_ok",
    event.missingFieldCount > 0 ? "missing_fields" : "ready_or_readonly"
  ].join("|");
}

export function groupAiAssistDiagnostics(events = []) {
  const groupsByKey = new Map();
  (Array.isArray(events) ? events : []).forEach((event) => {
    const key = aiAssistGroupKey(event);
    const existing = groupsByKey.get(key) || {
      key,
      providerStatus: event.providerStatus || "",
      module: event.module || "",
      actionType: (event.actionTypes || [])[0] || event.action || "",
      languageMismatch: event.languageMismatch === true,
      missingFieldCount: 0,
      readyActionCount: 0,
      mergedCount: 0,
      latestAt: 0,
      count: 0,
      latest: null,
      items: []
    };
    existing.count += 1;
    existing.missingFieldCount += Number(event.missingFieldCount || 0);
    existing.readyActionCount += Number(event.readyActionCount || 0);
    if (event.intakeTelemetry?.mergedFromRecentConversation === true) existing.mergedCount += 1;
    existing.items.push(event);
    const at = Number(event.at || 0);
    if (!existing.latest || at >= existing.latestAt) {
      existing.latestAt = at;
      existing.latest = event;
      existing.actorName = event.actorName || "";
      existing.actorRole = event.actorRole || "";
      existing.provider = event.provider || "";
      existing.model = event.model || "";
      existing.missingFields = event.missingFields || [];
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
