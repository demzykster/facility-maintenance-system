import { randomUUID } from "node:crypto";
import { sendJson } from "../httpErrors.js";
import { buildPublicHealthResponse, HEALTH_CHECK, HEALTH_STATUS } from "../../src/healthCheckModel.js";

const DEFAULT_TIMEOUT_MS = 2500;
const REQUIRED_CONFIG_KEYS = Object.freeze([
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CMMS_DATA_AUTHORITY",
  "CMMS_FILE_DRIVER",
  "CMMS_FILE_BUCKET"
]);

const headerValue = (headers = {}, name) => {
  const match = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  if (!match) return "";
  return Array.isArray(match[1]) ? match[1][0] : match[1];
};

const requestIdFor = (req = {}) => {
  const existing = String(
    headerValue(req.headers, "x-cmms-request-id")
    || headerValue(req.headers, "x-request-id")
    || headerValue(req.headers, "x-vercel-id")
    || ""
  ).trim();
  return existing || randomUUID();
};

const noCacheHeaders = (res) => {
  res.setHeader("cache-control", "no-store, no-cache, max-age=0, must-revalidate");
  res.setHeader("pragma", "no-cache");
  res.setHeader("expires", "0");
};

const shortVersion = (env = {}) => String(
  env.CMMS_BUILD_COMMIT
  || env.VERCEL_GIT_COMMIT_SHA
  || env.npm_package_version
  || "local"
).slice(0, 7);

const configured = (env = {}, key) => String(env[key] || "").trim().length > 0;

function configurationCheck(env = {}) {
  return REQUIRED_CONFIG_KEYS.every((key) => configured(env, key))
    ? HEALTH_CHECK.ok
    : HEALTH_CHECK.failed;
}

function storageConfigurationCheck(env = {}) {
  if (String(env.CMMS_FILE_DRIVER || "").trim() !== "supabase") return HEALTH_CHECK.failed;
  return configured(env, "CMMS_FILE_BUCKET") ? HEALTH_CHECK.ok : HEALTH_CHECK.failed;
}

async function withTimeout(promise, timeoutMs) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("health_dependency_timeout")), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function probeDatabase({ env = {}, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!configured(env, "SUPABASE_URL") || !configured(env, "SUPABASE_SERVICE_ROLE_KEY")) {
    return HEALTH_CHECK.failed;
  }
  if (typeof fetchImpl !== "function") return HEALTH_CHECK.failed;

  let abortTimer;
  try {
    const url = new URL("/rest/v1/app_config", env.SUPABASE_URL);
    url.searchParams.set("select", "id");
    url.searchParams.set("limit", "1");
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    abortTimer = setTimeout(() => controller?.abort(), timeoutMs);
    const response = await withTimeout(fetchImpl(url.toString(), {
      method: "HEAD",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        accept: "application/json"
      },
      signal: controller?.signal
    }), timeoutMs);
    return response?.ok ? HEALTH_CHECK.ok : HEALTH_CHECK.failed;
  } catch {
    return HEALTH_CHECK.failed;
  } finally {
    clearTimeout(abortTimer);
  }
}

async function runHealthChecks({ env = process.env, fetchImpl = globalThis.fetch, timeoutMs } = {}) {
  const configuration = configurationCheck(env);
  const database = await probeDatabase({ env, fetchImpl, timeoutMs });
  return {
    api: HEALTH_CHECK.ok,
    configuration,
    database,
    storage: storageConfigurationCheck(env)
  };
}

export function createHealthHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  timeoutMs = Number(process.env.CMMS_HEALTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
} = {}) {
  return async function healthHandler(req, res) {
    const method = String(req?.method || "GET").toUpperCase();
    noCacheHeaders(res);
    if (!["GET", "HEAD"].includes(method)) {
      res.setHeader("allow", "GET, HEAD");
      return sendJson(res, 405, { error: "method_not_allowed" });
    }

    const requestId = requestIdFor(req);
    const checks = await runHealthChecks({ env, fetchImpl, timeoutMs });
    const body = buildPublicHealthResponse({
      checks,
      version: shortVersion(env),
      timestamp: now(),
      requestId
    });
    const statusCode = body.status === HEALTH_STATUS.ok ? 200 : 503;
    if (body.status !== HEALTH_STATUS.ok) res.setHeader("x-cmms-request-id", requestId);
    if (method === "HEAD") {
      res.statusCode = statusCode;
      return res.end();
    }
    return sendJson(res, statusCode, body);
  };
}

export default createHealthHandler();
