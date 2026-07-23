import { healthEndpointUrl, validateHealthPayload } from "./healthSmokeModel.js";

const DEFAULT_TIMEOUT_MS = 5000;
const REQUIRED_ARGS = Object.freeze(["productionUrl", "expectedCurrentSha", "targetSha"]);
const DESTRUCTIVE_MIGRATION_PATTERNS = Object.freeze([
  /\bdrop\s+table\b/i,
  /\bdrop\s+column\b/i,
  /\balter\s+table\b[\s\S]{0,160}\bdrop\b/i,
  /\btruncate\s+table\b/i,
  /\bdelete\s+from\b/i,
  /\bdrop\s+function\b/i,
  /\bdrop\s+policy\b/i,
  /\bdrop\s+trigger\b/i,
  /\bdrop\s+type\b/i
]);
const MUTATING_COMMAND_PATTERN = /\b(push|deploy|rollback|alias|promote|remove|rm|delete|insert|update|upsert|patch|post|put)\b/i;

export function parseRollbackVerifyArgs(argv = [], env = {}) {
  const args = [...argv];
  const parsed = {
    productionUrl: env.CMMS_ROLLBACK_PRODUCTION_URL || "",
    expectedCurrentSha: env.CMMS_ROLLBACK_EXPECTED_CURRENT_SHA || "",
    targetSha: env.CMMS_ROLLBACK_TARGET_SHA || "",
    postRollbackExpectedSha: env.CMMS_ROLLBACK_POST_EXPECTED_SHA || "",
    timeoutMs: Number(env.CMMS_ROLLBACK_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args[index] || "");
    const next = () => {
      index += 1;
      return args[index] || "";
    };
    if (arg === "--production-url" || arg === "--url") parsed.productionUrl = next();
    else if (arg.startsWith("--production-url=")) parsed.productionUrl = arg.slice("--production-url=".length);
    else if (arg.startsWith("--url=")) parsed.productionUrl = arg.slice("--url=".length);
    else if (arg === "--expected-current-sha") parsed.expectedCurrentSha = next();
    else if (arg.startsWith("--expected-current-sha=")) parsed.expectedCurrentSha = arg.slice("--expected-current-sha=".length);
    else if (arg === "--target-sha" || arg === "--target") parsed.targetSha = next();
    else if (arg.startsWith("--target-sha=")) parsed.targetSha = arg.slice("--target-sha=".length);
    else if (arg.startsWith("--target=")) parsed.targetSha = arg.slice("--target=".length);
    else if (arg === "--post-rollback-expected-sha") parsed.postRollbackExpectedSha = next();
    else if (arg.startsWith("--post-rollback-expected-sha=")) {
      parsed.postRollbackExpectedSha = arg.slice("--post-rollback-expected-sha=".length);
    } else if (arg === "--timeout") parsed.timeoutMs = Number(next());
    else if (arg.startsWith("--timeout=")) parsed.timeoutMs = Number(arg.slice("--timeout=".length));
  }

  return {
    ...parsed,
    productionUrl: String(parsed.productionUrl || "").trim(),
    expectedCurrentSha: String(parsed.expectedCurrentSha || "").trim(),
    targetSha: String(parsed.targetSha || "").trim(),
    postRollbackExpectedSha: String(parsed.postRollbackExpectedSha || "").trim(),
    timeoutMs: Number.isFinite(parsed.timeoutMs) && parsed.timeoutMs > 0 ? parsed.timeoutMs : DEFAULT_TIMEOUT_MS
  };
}

export function rollbackVersionUrl(productionUrl = "") {
  const url = new URL(productionUrl);
  url.pathname = "/cmms-version.json";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function shaMatches(actual = "", expected = "") {
  const left = String(actual || "").trim();
  const right = String(expected || "").trim();
  if (!left || !right) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

export function publicSha(value = "") {
  const match = String(value || "").trim().match(/[a-f0-9]{7,40}/i);
  return match ? match[0] : "";
}

export function detectMigrationRisk(name = "", content = "") {
  const destructive = DESTRUCTIVE_MIGRATION_PATTERNS.some((pattern) => pattern.test(content));
  return {
    file: String(name || ""),
    destructive,
    risk: destructive ? "destructive_or_irreversible_sql" : "schema_delta_requires_review"
  };
}

export function validateReadonlyCommand(args = []) {
  const command = Array.isArray(args) ? args.join(" ") : String(args || "");
  return !MUTATING_COMMAND_PATTERN.test(command);
}

async function fetchJson(url, { fetchImpl, timeoutMs }) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller?.signal
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      return { ok: false, statusCode: response.status, error: "malformed_json" };
    }
    return { ok: response.ok, statusCode: response.status, payload };
  } catch (error) {
    return { ok: false, error: error?.name === "AbortError" ? "timeout" : "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

async function git(gitImpl, args) {
  if (!validateReadonlyCommand(args)) return { ok: false, stdout: "", error: "mutating_command_blocked" };
  try {
    const stdout = await gitImpl(args);
    return { ok: true, stdout: String(stdout || "").trim() };
  } catch {
    return { ok: false, stdout: "", error: "git_command_failed" };
  }
}

async function commitExists({ gitImpl, sha }) {
  const result = await git(gitImpl, ["rev-parse", "--verify", `${sha}^{commit}`]);
  return { ok: result.ok, sha: result.stdout || sha };
}

async function targetReleaseScripts({ gitImpl, targetSha }) {
  const result = await git(gitImpl, ["show", `${targetSha}:package.json`]);
  if (!result.ok) return { ok: false, error: "target_package_json_unavailable" };
  try {
    const pkg = JSON.parse(result.stdout);
    const scripts = pkg?.scripts || {};
    return {
      ok: Boolean(scripts.build && scripts["release:check"]),
      build: Boolean(scripts.build),
      releaseCheck: Boolean(scripts["release:check"])
    };
  } catch {
    return { ok: false, error: "target_package_json_malformed" };
  }
}

async function migrationDelta({ gitImpl, currentSha, targetSha }) {
  const result = await git(gitImpl, ["diff", "--name-status", `${targetSha}..${currentSha}`, "--", "supabase/migrations"]);
  if (!result.ok) return { ok: false, unsafe: true, error: "migration_diff_unavailable", files: [] };
  const lines = result.stdout ? result.stdout.split(/\r?\n/).filter(Boolean) : [];
  const files = [];
  for (const line of lines) {
    const [status, file] = line.split(/\s+/);
    let content = "";
    if (file && status !== "D") {
      const shown = await git(gitImpl, ["show", `${currentSha}:${file}`]);
      content = shown.ok ? shown.stdout : "";
    }
    files.push({ status, ...detectMigrationRisk(file, content) });
  }
  return {
    ok: true,
    unsafe: files.length > 0,
    files,
    summary: files.length ? "ROLLBACK_UNSAFE" : "no_migration_delta"
  };
}

export async function verifyRollbackReadiness({
  argv = [],
  env = process.env,
  fetchImpl = globalThis.fetch,
  gitImpl,
  now = () => new Date().toISOString()
} = {}) {
  const args = parseRollbackVerifyArgs(argv, env);
  const missing = REQUIRED_ARGS.filter((key) => !args[key]);
  const result = {
    ok: false,
    status: "failed",
    timestamp: now(),
    checks: {},
    errors: [],
    warnings: []
  };

  if (missing.length) {
    result.errors.push(`missing_args:${missing.join(",")}`);
    return result;
  }
  if (typeof fetchImpl !== "function") {
    result.errors.push("fetch_unavailable");
    return result;
  }
  if (typeof gitImpl !== "function") {
    result.errors.push("git_unavailable");
    return result;
  }

  let version;
  try {
    version = await fetchJson(rollbackVersionUrl(args.productionUrl), { fetchImpl, timeoutMs: args.timeoutMs });
  } catch {
    result.errors.push("invalid_production_url");
    return result;
  }
  if (!version.ok || !version.payload?.commit) {
    result.checks.version = "failed";
    result.errors.push("version_endpoint_unavailable");
  } else {
    const expectedLiveSha = args.postRollbackExpectedSha || args.expectedCurrentSha;
    const match = shaMatches(version.payload.commit, expectedLiveSha);
    result.checks.version = match ? "ok" : "failed";
    result.version = { commit: publicSha(version.payload.commit) || "unrecognized" };
    if (!match) result.errors.push("current_sha_mismatch");
  }

  const health = await fetchJson(healthEndpointUrl(args.productionUrl), { fetchImpl, timeoutMs: args.timeoutMs });
  if (!health.ok || !validateHealthPayload(health.payload).ok) {
    result.checks.health = "failed";
    result.errors.push("health_degraded");
  } else {
    result.checks.health = "ok";
  }

  const current = await commitExists({ gitImpl, sha: args.expectedCurrentSha });
  result.checks.currentCommit = current.ok ? "ok" : "failed";
  if (!current.ok) result.errors.push("current_commit_missing");

  const target = await commitExists({ gitImpl, sha: args.targetSha });
  result.checks.targetCommit = target.ok ? "ok" : "failed";
  if (!target.ok) result.errors.push("target_commit_missing");

  const scripts = target.ok ? await targetReleaseScripts({ gitImpl, targetSha: args.targetSha }) : { ok: false };
  result.checks.targetReleaseScripts = scripts.ok ? "ok" : "failed";
  if (!scripts.ok) result.errors.push("target_release_checks_unavailable");

  const migrations = target.ok && current.ok
    ? await migrationDelta({ gitImpl, currentSha: args.expectedCurrentSha, targetSha: args.targetSha })
    : { ok: false, unsafe: false, error: "migration_check_skipped_commit_missing", files: [] };
  result.migrations = {
    summary: migrations.summary || "migration_check_failed",
    files: migrations.files || []
  };
  result.checks.migrationCompatibility = migrations.ok && !migrations.unsafe ? "ok" : "failed";
  if (!migrations.ok && target.ok && current.ok) result.errors.push(migrations.error || "migration_check_failed");
  if (migrations.unsafe) result.errors.push("migration_risk_detected");

  result.rollbackPlan = {
    manualOnly: true,
    mutatesProduction: false,
    allowedVerificationCommands: [
      "git rev-parse --verify <target>^{commit}",
      "git show <target>:package.json",
      "git diff --name-status <target>..<current> -- supabase/migrations",
      "GET /cmms-version.json",
      "GET /api/health"
    ],
    prohibitedCommands: [
      "vercel rollback",
      "vercel alias set",
      "vercel deploy",
      "supabase db push",
      "supabase migration repair"
    ]
  };

  result.ok = result.errors.length === 0;
  result.status = result.ok ? "ready" : (result.errors.includes("migration_risk_detected") ? "ROLLBACK_UNSAFE" : "failed");
  return result;
}
