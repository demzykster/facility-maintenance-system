import { healthEndpointUrl, validateHealthPayload } from "./healthSmokeModel.js";
import { publicSha, shaMatches } from "./rollbackReadinessModel.js";

const DEFAULT_TIMEOUT_MS = 5000;
const REQUIRED_ARGS = Object.freeze(["currentUrl", "candidateUrl", "expectedSha"]);
const MUTATION_METHODS = Object.freeze(["POST", "PUT", "PATCH", "DELETE"]);
const DOMAIN_PATTERNS = Object.freeze([
  /facility-maintenance-system\.vercel\.app/i,
  /https?:\/\/[^\s"'`<>]+/i,
  /vercel\.app/i
]);

export function parseDomainVerifyArgs(argv = [], env = {}) {
  const parsed = {
    currentUrl: env.CMMS_DOMAIN_CURRENT_URL || "",
    candidateUrl: env.CMMS_DOMAIN_CANDIDATE_URL || "",
    expectedSha: env.CMMS_DOMAIN_EXPECTED_SHA || "",
    timeoutMs: Number(env.CMMS_DOMAIN_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  };
  const args = [...argv];
  const next = () => args.shift() || "";

  while (args.length) {
    const arg = String(args.shift() || "");
    if (arg === "--current-url") parsed.currentUrl = next();
    else if (arg.startsWith("--current-url=")) parsed.currentUrl = arg.slice("--current-url=".length);
    else if (arg === "--candidate-url") parsed.candidateUrl = next();
    else if (arg.startsWith("--candidate-url=")) parsed.candidateUrl = arg.slice("--candidate-url=".length);
    else if (arg === "--expected-sha") parsed.expectedSha = next();
    else if (arg.startsWith("--expected-sha=")) parsed.expectedSha = arg.slice("--expected-sha=".length);
    else if (arg === "--timeout") parsed.timeoutMs = Number(next());
    else if (arg.startsWith("--timeout=")) parsed.timeoutMs = Number(arg.slice("--timeout=".length));
  }

  return {
    currentUrl: String(parsed.currentUrl || "").trim(),
    candidateUrl: String(parsed.candidateUrl || "").trim(),
    expectedSha: String(parsed.expectedSha || "").trim(),
    timeoutMs: Number.isFinite(parsed.timeoutMs) && parsed.timeoutMs > 0 ? parsed.timeoutMs : DEFAULT_TIMEOUT_MS
  };
}

export function normalizedBaseUrl(value = "") {
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function domainEndpointUrl(baseUrl = "", pathname = "/") {
  const url = new URL(pathname, normalizedBaseUrl(baseUrl));
  return url.toString();
}

export function versionEndpointUrl(baseUrl = "") {
  return domainEndpointUrl(baseUrl, "/cmms-version.json");
}

export function classifyDomainReference({ file = "", line = "" } = {}) {
  const path = String(file || "");
  const text = String(line || "");
  if (!DOMAIN_PATTERNS.some((pattern) => pattern.test(text))) return "DOMAIN_INDEPENDENT";
  if (/^(docs|tests)\//.test(path)) return "HARDCODED_SAFE";
  if (/^\.github\/workflows\//.test(path)) return "CONFIGURABLE";
  if (/^tools\/staging-|^tools\/demo-|^tools\/health-|^tools\/rollback-|^tools\/domain-/.test(path)) return "CONFIGURABLE";
  if (/^package\.json$/.test(path) || /repository|github\.com/i.test(text)) return "HARDCODED_SAFE";
  if (/localhost|127\.0\.0\.1|cmms\.local|example\./i.test(text)) return "HARDCODED_SAFE";
  if (/SUPABASE_URL|supabase\.co|api\.anthropic\.com/i.test(text)) return "EXTERNAL_CONFIGURATION";
  if (/^src\/|^server\/|^api\/|^public\//.test(path)) return "HARDCODED_RISK";
  return "OWNER_DECISION";
}

export function scanDomainCoupling(entries = []) {
  return entries
    .map((entry) => ({
      ...entry,
      classification: classifyDomainReference(entry)
    }))
    .filter((entry) => entry.classification !== "DOMAIN_INDEPENDENT");
}

function schema() {
  return {
    ok: false,
    status: "failed",
    timestamp: "",
    checks: {},
    errors: [],
    warnings: [],
    current: {},
    candidate: {},
    routes: [],
    safety: {
      mutatesProduction: false,
      methods: []
    }
  };
}

function validateArgs(args) {
  const missing = REQUIRED_ARGS.filter((key) => !args[key]);
  if (missing.length) return [`missing_args:${missing.join(",")}`];
  const errors = [];
  try {
    const candidate = new URL(args.candidateUrl);
    if (candidate.protocol !== "https:") errors.push("candidate_url_requires_https");
  } catch {
    errors.push("invalid_candidate_url");
  }
  try {
    new URL(args.currentUrl);
  } catch {
    errors.push("invalid_current_url");
  }
  return errors;
}

function responseFinalUrl(response, requestedUrl) {
  return String(response?.url || requestedUrl || "");
}

function classifyFetchError(error) {
  if (error?.name === "AbortError") return "timeout";
  if (/redirect|loop/i.test(String(error?.message || ""))) return "redirect_loop";
  return "unavailable";
}

async function fetchWithTimeout(url, { fetchImpl, timeoutMs, method = "GET", accept = "application/json" }) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      method,
      headers: { accept },
      redirect: "follow",
      signal: controller?.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, { fetchImpl, timeoutMs }) {
  try {
    const response = await fetchWithTimeout(url, { fetchImpl, timeoutMs, method: "GET" });
    const text = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      return { ok: false, statusCode: response.status, error: "malformed_json", finalUrl: responseFinalUrl(response, url) };
    }
    return { ok: response.ok, statusCode: response.status, payload, finalUrl: responseFinalUrl(response, url) };
  } catch (error) {
    return { ok: false, error: classifyFetchError(error), finalUrl: url };
  }
}

function compareFinalUrl({ requestedUrl, finalUrl, expectedHost, requirePathQuery = false }) {
  let requested;
  let final;
  try {
    requested = new URL(requestedUrl);
    final = new URL(finalUrl || requestedUrl);
  } catch {
    return "invalid_final_url";
  }
  if (final.protocol !== "https:") return "http_downgrade";
  if (final.host !== expectedHost) return "unexpected_final_host";
  if (requirePathQuery && final.pathname !== requested.pathname) return "redirect_loses_path";
  if (requirePathQuery && final.search !== requested.search) return "redirect_loses_query";
  return "";
}

async function probeRoute({ key, url, expectedHost, fetchImpl, timeoutMs, method = "GET", requirePathQuery = false }) {
  try {
    const response = await fetchWithTimeout(url, {
      fetchImpl,
      timeoutMs,
      method,
      accept: "text/html,application/json;q=0.9,*/*;q=0.8"
    });
    const finalUrl = responseFinalUrl(response, url);
    const redirectError = compareFinalUrl({ requestedUrl: url, finalUrl, expectedHost, requirePathQuery });
    if (redirectError) return { key, ok: false, method, statusCode: response.status, finalUrl, error: redirectError };
    if (!response.ok) return { key, ok: false, method, statusCode: response.status, finalUrl, error: "route_unavailable" };
    return { key, ok: true, method, statusCode: response.status, finalUrl };
  } catch (error) {
    return { key, ok: false, method, error: classifyFetchError(error), finalUrl: url };
  }
}

export async function verifyDomainPortability({
  argv = [],
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString()
} = {}) {
  const args = parseDomainVerifyArgs(argv, env);
  const result = schema();
  result.timestamp = now();

  const argErrors = validateArgs(args);
  if (argErrors.length) {
    result.errors.push(...argErrors);
    result.checks.arguments = "failed";
    return result;
  }
  if (typeof fetchImpl !== "function") {
    result.errors.push("fetch_unavailable");
    result.checks.fetch = "failed";
    return result;
  }

  const candidateBase = normalizedBaseUrl(args.candidateUrl);
  const currentBase = normalizedBaseUrl(args.currentUrl);
  const candidateHost = new URL(candidateBase).host;
  result.current = { url: currentBase };
  result.candidate = { url: candidateBase };
  result.checks.arguments = "ok";

  const currentVersion = await fetchJson(versionEndpointUrl(currentBase), { fetchImpl, timeoutMs: args.timeoutMs });
  if (!currentVersion.ok || !currentVersion.payload?.commit) {
    result.checks.currentVersion = "failed";
    result.errors.push("current_version_unavailable");
  } else {
    result.current.version = publicSha(currentVersion.payload.commit) || "unrecognized";
    result.checks.currentVersion = shaMatches(currentVersion.payload.commit, args.expectedSha) ? "ok" : "failed";
    if (result.checks.currentVersion === "failed") result.errors.push("current_version_mismatch");
  }

  const candidateVersion = await fetchJson(versionEndpointUrl(candidateBase), { fetchImpl, timeoutMs: args.timeoutMs });
  if (!candidateVersion.ok || !candidateVersion.payload?.commit) {
    result.checks.candidateVersion = "failed";
    result.errors.push("candidate_version_unavailable");
  } else {
    result.candidate.version = publicSha(candidateVersion.payload.commit) || "unrecognized";
    result.checks.candidateVersion = shaMatches(candidateVersion.payload.commit, args.expectedSha) ? "ok" : "failed";
    if (result.checks.candidateVersion === "failed") result.errors.push("version_mismatch");
  }

  const health = await fetchJson(healthEndpointUrl(candidateBase), { fetchImpl, timeoutMs: args.timeoutMs });
  const healthValidation = validateHealthPayload(health.payload || {});
  if (!health.ok || !healthValidation.ok) {
    result.checks.health = "failed";
    result.errors.push(health.error === "timeout" ? "health_timeout" : "health_degraded");
  } else {
    result.checks.health = "ok";
  }

  const routeChecks = [
    await probeRoute({ key: "root_get", url: candidateBase, expectedHost: candidateHost, fetchImpl, timeoutMs: args.timeoutMs }),
    await probeRoute({ key: "root_head", url: candidateBase, expectedHost: candidateHost, fetchImpl, timeoutMs: args.timeoutMs, method: "HEAD" }),
    await probeRoute({ key: "public_cleaning_zones", url: domainEndpointUrl(candidateBase, "/api/public/zones"), expectedHost: candidateHost, fetchImpl, timeoutMs: args.timeoutMs }),
    await probeRoute({
      key: "path_query_preservation",
      url: domainEndpointUrl(candidateBase, "/api/public/zones?cmms_probe=path-query"),
      expectedHost: candidateHost,
      fetchImpl,
      timeoutMs: args.timeoutMs,
      requirePathQuery: true
    })
  ];
  result.routes = routeChecks.map((route) => ({
    key: route.key,
    method: route.method,
    ok: route.ok,
    statusCode: route.statusCode,
    finalUrl: route.finalUrl,
    error: route.error
  }));
  for (const route of routeChecks) {
    result.checks[route.key] = route.ok ? "ok" : "failed";
    if (!route.ok) result.errors.push(route.error || `${route.key}_failed`);
  }
  result.safety.methods = routeChecks.map((route) => route.method || "GET");
  if (result.safety.methods.some((method) => MUTATION_METHODS.includes(method))) {
    result.errors.push("mutation_method_detected");
  }

  result.ok = result.errors.length === 0;
  result.status = result.ok ? "ready" : "failed";
  return result;
}
