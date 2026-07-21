const DEFAULT_TIMEOUT_MS = 5000;

export function parseHealthSmokeArgs(argv = [], env = {}) {
  const args = [...argv];
  let baseUrl = env.CMMS_HEALTH_BASE_URL || "";
  let timeoutMs = Number(env.CMMS_HEALTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--url" || arg === "--base-url") {
      baseUrl = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--url=")) {
      baseUrl = arg.slice("--url=".length);
    } else if (arg.startsWith("--base-url=")) {
      baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--timeout") {
      timeoutMs = Number(args[index + 1] || timeoutMs);
      index += 1;
    } else if (arg.startsWith("--timeout=")) {
      timeoutMs = Number(arg.slice("--timeout=".length));
    } else if (!arg.startsWith("-") && !baseUrl) {
      baseUrl = arg;
    }
  }

  return {
    baseUrl: String(baseUrl || "").trim(),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS
  };
}

export function healthEndpointUrl(baseUrl = "") {
  const url = new URL(baseUrl);
  if (url.pathname.endsWith("/api/health")) return url.toString();
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/health`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function validateHealthPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "malformed_health_payload" };
  }
  if (!["ok", "degraded"].includes(payload.status)) {
    return { ok: false, error: "invalid_health_status" };
  }
  if (!payload.checks || typeof payload.checks !== "object" || Array.isArray(payload.checks)) {
    return { ok: false, error: "missing_health_checks" };
  }
  if (!payload.timestamp || Number.isNaN(Date.parse(payload.timestamp))) {
    return { ok: false, error: "invalid_health_timestamp" };
  }
  if (payload.status !== "ok") {
    return { ok: false, error: `health_${payload.status}` };
  }
  return { ok: true, status: payload.status, version: String(payload.version || "unknown") };
}

async function fetchWithTimeout(url, { timeoutMs, fetchImpl }) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller?.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function runHealthSmoke({
  argv = [],
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const { baseUrl, timeoutMs } = parseHealthSmokeArgs(argv, env);
  if (!baseUrl) return { ok: false, error: "missing_health_url" };
  let url;
  try {
    url = healthEndpointUrl(baseUrl);
  } catch {
    return { ok: false, error: "invalid_health_url" };
  }
  if (typeof fetchImpl !== "function") return { ok: false, error: "fetch_unavailable", url };

  try {
    const response = await fetchWithTimeout(url, { timeoutMs, fetchImpl });
    const contentType = String(response.headers?.get?.("content-type") || "");
    if (!contentType.toLowerCase().includes("application/json")) {
      return { ok: false, error: "health_wrong_content_type", statusCode: response.status, url };
    }
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return { ok: false, error: "health_malformed_json", statusCode: response.status, url };
    }
    const validation = validateHealthPayload(payload);
    if (!response.ok || !validation.ok) {
      return {
        ok: false,
        error: validation.error || "health_http_failure",
        statusCode: response.status,
        status: payload.status,
        requestId: payload.requestId,
        url
      };
    }
    return { ok: true, statusCode: response.status, version: validation.version, url };
  } catch (error) {
    return {
      ok: false,
      error: error?.name === "AbortError" ? "health_timeout" : "health_connection_failed",
      url
    };
  }
}
