export const HEALTH_STATUS = Object.freeze({
  ok: "ok",
  degraded: "degraded"
});

export const HEALTH_CHECK = Object.freeze({
  ok: "ok",
  failed: "failed",
  skipped: "skipped"
});

export const HEALTH_CHECK_NAMES = Object.freeze([
  "api",
  "configuration",
  "database",
  "storage"
]);

const CHECK_VALUES = new Set(Object.values(HEALTH_CHECK));

export function normalizeHealthCheckValue(value) {
  return CHECK_VALUES.has(value) ? value : HEALTH_CHECK.failed;
}

export function normalizeHealthChecks(checks = {}) {
  return HEALTH_CHECK_NAMES.reduce((acc, name) => {
    acc[name] = normalizeHealthCheckValue(checks[name]);
    return acc;
  }, {});
}

export function healthStatusForChecks(checks = {}) {
  const normalized = normalizeHealthChecks(checks);
  return Object.values(normalized).every((value) => value === HEALTH_CHECK.ok)
    ? HEALTH_STATUS.ok
    : HEALTH_STATUS.degraded;
}

export function buildPublicHealthResponse({
  checks = {},
  version = "local",
  timestamp = new Date().toISOString(),
  requestId = ""
} = {}) {
  const normalizedChecks = normalizeHealthChecks(checks);
  const status = healthStatusForChecks(normalizedChecks);
  const response = {
    status,
    version: String(version || "local").slice(0, 40),
    checks: normalizedChecks,
    timestamp
  };
  if (status !== HEALTH_STATUS.ok && requestId) response.requestId = String(requestId).slice(0, 120);
  return response;
}
