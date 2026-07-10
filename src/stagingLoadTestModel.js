export const LOAD_TEST_PREFIX = "loadtest";

export const LOAD_TEST_PROFILES = Object.freeze({
  smoke: Object.freeze({
    tickets: 25,
    tasks: 25,
    meetings: 5,
    fleet: 10,
    cleaningComplaints: 10
  }),
  pilot: Object.freeze({
    tickets: 1000,
    tasks: 1000,
    meetings: 100,
    fleet: 250,
    cleaningComplaints: 500
  }),
  tenk: Object.freeze({
    tickets: 10000,
    tasks: 5000,
    meetings: 500,
    fleet: 1000,
    cleaningComplaints: 5000
  })
});

export const DEFAULT_LOAD_TEST_THRESHOLDS = Object.freeze({
  apiP95Ms: 1000,
  apiMaxMs: 3000,
  seedMs: 120000,
  cleanupMs: 120000
});

const positiveInt = (value, fallback) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.floor(number);
};

export function normalizeLoadTestProfile(profile = "smoke", overrides = {}) {
  const base = LOAD_TEST_PROFILES[String(profile || "").trim()] || LOAD_TEST_PROFILES.smoke;
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, positiveInt(overrides[key], value)])
  );
}

export function createLoadTestRunId(seed = Date.now()) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${LOAD_TEST_PREFIX}-${seed}-${suffix}`;
}

export function loadTestRecordId(runId, kind, index) {
  const safeRunId = String(runId || "").trim();
  const safeKind = String(kind || "").trim();
  const safeIndex = String(index).padStart(6, "0");
  if (!safeRunId.startsWith(`${LOAD_TEST_PREFIX}-`)) throw new Error("loadtest_run_id_required");
  if (!safeKind) throw new Error("loadtest_kind_required");
  return `${safeRunId}-${safeKind}-${safeIndex}`;
}

export function isLoadTestId(value = "") {
  return String(value || "").startsWith(`${LOAD_TEST_PREFIX}-`);
}

export function loadTestBatch(items = [], batchSize = 500) {
  const size = Math.max(1, Math.floor(Number(batchSize) || 500));
  const batches = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

export function percentile(values = [], pct = 95) {
  const sorted = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((pct / 100) * sorted.length) - 1);
  return sorted[index];
}

export function summarizeLoadTimings(samples = [], thresholds = DEFAULT_LOAD_TEST_THRESHOLDS) {
  const durations = samples.map((sample) => Number(sample.durationMs)).filter(Number.isFinite);
  const maxMs = durations.length ? Math.max(...durations) : 0;
  const p95Ms = percentile(durations, 95);
  const p99Ms = percentile(durations, 99);
  const failures = samples.filter((sample) => sample.ok === false || sample.status >= 400);
  const thresholdFailures = [];
  if (p95Ms > thresholds.apiP95Ms) thresholdFailures.push(`api_p95_ms:${p95Ms}`);
  if (maxMs > thresholds.apiMaxMs) thresholdFailures.push(`api_max_ms:${maxMs}`);
  return {
    count: samples.length,
    failures: failures.length,
    p95Ms,
    p99Ms,
    maxMs,
    ok: failures.length === 0 && thresholdFailures.length === 0,
    thresholdFailures
  };
}
