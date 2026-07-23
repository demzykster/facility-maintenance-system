export const PLATFORM_CLASSIFICATIONS = Object.freeze([
  "PLATFORM_INDEPENDENT",
  "STANDARD_NODE",
  "CONFIGURATION_ONLY",
  "VERCEL_TOOLING_ONLY",
  "VERCEL_RUNTIME_DEPENDENCY",
  "PORTABILITY_RISK",
  "OWNER_DECISION"
]);

export const PLATFORM_TARGETS = Object.freeze([
  "vercel",
  "docker",
  "cloud-run",
  "azure-app-service",
  "generic-node"
]);

export const PLATFORM_STATUSES = Object.freeze([
  "READY",
  "READY_WITH_CONFIG",
  "SMALL_ADAPTER_REQUIRED",
  "ARCHITECTURAL_CHANGE_REQUIRED",
  "NOT_VERIFIED"
]);

const SECRET_NAME_PATTERN = /(SECRET|TOKEN|PASSWORD|KEY|PRIVATE|SERVICE_ROLE|API_KEY)/i;
const PUBLIC_ENV_PREFIX = /^VITE_/;
const PLATFORM_ENV_NAMES = new Set([
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_URL",
  "GITHUB_HEAD_REF"
]);
const MUTATION_COMMAND_PATTERN = /\b(vercel\s+(deploy|alias|rollback)|supabase\s+(db\s+push|link|secrets|functions\s+deploy)|curl\b.*\b(-X\s+)?(POST|PUT|PATCH|DELETE)\b)/i;
const NODE_MUTATION_COMMAND_PATTERN = /\bexecFile(?:Sync)?\(\s*["'](?:vercel|supabase)["']\s*,\s*\[[^\]]*["'](?:deploy|alias|rollback|db\s+push|link|secrets|functions\s+deploy)["']/i;
const RUNTIME_PATH_PATTERN = /^(api|server)\//;
const TOOLING_PATH_PATTERN = /^(docs|tests|tools|\.github)\//;
const REPORTABLE_TOOLING_PATH_PATTERN = /^(tools|\.github)\//;
const EXECUTABLE_PATH_PATTERN = /^(tools|\.github)\//;
const TOOLING_MODEL_PATHS = new Set([
  "src/domainPortabilityModel.js",
  "src/platformPortabilityModel.js",
  "src/rollbackReadinessModel.js",
  "src/vercelApiRouteModel.js",
  "src/vercelEnvPreflightModel.js"
]);
const ENV_INVENTORY_PATH_PATTERN = /^(api|server|src)\//;
const WRITE_CALL_PATTERN = /\b(writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|mkdir(?:Sync)?|rm(?:Sync)?|unlink(?:Sync)?|rmdir(?:Sync)?)\s*\(/;

export function parsePlatformVerifyArgs(argv = []) {
  const parsed = { target: "vercel", format: "json", skipBuild: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (arg === "--target") {
      parsed.target = String(argv[index + 1] || "");
      index += 1;
    }
    else if (arg.startsWith("--target=")) parsed.target = arg.slice("--target=".length);
    else if (arg === "--format") {
      parsed.format = String(argv[index + 1] || "");
      index += 1;
    }
    else if (arg.startsWith("--format=")) parsed.format = arg.slice("--format=".length);
    else if (arg === "--skip-build") parsed.skipBuild = true;
  }
  parsed.target = String(parsed.target || "").trim();
  parsed.format = String(parsed.format || "json").trim();
  return parsed;
}

export function stableJson(value) {
  return JSON.stringify(sortStable(value), null, 2);
}

function sortStable(value) {
  if (Array.isArray(value)) return value.map(sortStable);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = sortStable(value[key]);
    return acc;
  }, {});
}

export function classifyEnvironmentName(name = "", { files = [] } = {}) {
  const envName = String(name || "").trim();
  const readFiles = files.map(String).sort();
  const platformProvided = PLATFORM_ENV_NAMES.has(envName);
  const isPublic = PUBLIC_ENV_PREFIX.test(envName);
  const isSecret = SECRET_NAME_PATTERN.test(envName) && !isPublic;
  const category = platformProvided
    ? "platform-provided"
    : isSecret
      ? "runtime-secret"
      : isPublic
        ? "build-time-public"
        : /^(PORT|NODE_ENV|CMMS_BUILD_COMMIT|CMMS_HEALTH_TIMEOUT_MS)$/.test(envName)
          ? "runtime-public"
          : "runtime-secret";
  return {
    name: envName,
    category,
    files: readFiles,
    requiredOnNewHost: !platformProvided,
    hasSafeDefault: /^(PORT|NODE_ENV|CMMS_BUILD_COMMIT|CMMS_HEALTH_TIMEOUT_MS|CMMS_AI_|VITE_CMMS_)/.test(envName),
    vercelSpecific: platformProvided || /^VERCEL_/.test(envName),
    neutralAlternative: envName === "VERCEL_GIT_COMMIT_SHA" ? "CMMS_BUILD_COMMIT" : ""
  };
}

export function classifyVercelReference({ file = "", line = "" } = {}) {
  const path = normalizePath(file);
  const text = String(line || "");
  if (!/vercel|x-vercel|VERCEL|@vercel/i.test(text) && path !== "vercel.json") return "PLATFORM_INDEPENDENT";
  if (TOOLING_PATH_PATTERN.test(path) || path === "package.json") return "VERCEL_TOOLING_ONLY";
  if (TOOLING_MODEL_PATHS.has(path)) return "VERCEL_TOOLING_ONLY";
  if (path === "vercel.json") return "VERCEL_RUNTIME_DEPENDENCY";
  if (/VERCEL_GIT_COMMIT_SHA/.test(text)) return "CONFIGURATION_ONLY";
  if (/env\.VERCEL\b|process\.env\.VERCEL\b|x-vercel-id/i.test(text)) return "CONFIGURATION_ONLY";
  if (RUNTIME_PATH_PATTERN.test(path)) return "VERCEL_RUNTIME_DEPENDENCY";
  return "OWNER_DECISION";
}

export function detectPersistentFilesystemWrites(entries = []) {
  return entries
    .map((entry) => ({
      file: normalizePath(entry.file),
      line: String(entry.line || "").trim()
    }))
    .filter((entry) => RUNTIME_PATH_PATTERN.test(entry.file))
    .filter((entry) => WRITE_CALL_PATTERN.test(entry.line))
    .map((entry) => ({
      ...entry,
      classification: /\/tmp|tmpdir/i.test(entry.line) ? "STANDARD_NODE" : "PORTABILITY_RISK"
    }));
}

export function scanPlatformInventory(entries = []) {
  const vercelReferences = [];
  const filesystemWrites = [];
  const envByName = new Map();
  const unsafeCommands = [];

  for (const entry of entries) {
    const file = normalizePath(entry.file);
    const line = String(entry.line || "");
    const classification = classifyVercelReference({ file, line });
    if (classification !== "PLATFORM_INDEPENDENT" && (classification !== "VERCEL_TOOLING_ONLY" || REPORTABLE_TOOLING_PATH_PATTERN.test(file) || file === "package.json")) {
      const vercelLine = file === "vercel.json" ? "runtime headers and manifest rewrite" : line.trim();
      vercelReferences.push({ file, line: vercelLine, classification });
    }
    if (RUNTIME_PATH_PATTERN.test(file) && WRITE_CALL_PATTERN.test(line)) {
      filesystemWrites.push({ file, line: line.trim(), classification: /\/tmp|tmpdir/i.test(line) ? "STANDARD_NODE" : "PORTABILITY_RISK" });
    }
    if (ENV_INVENTORY_PATH_PATTERN.test(file) || file === "vite.config.js" || file === "package.json") {
      for (const envName of extractEnvNames(line)) {
        const current = envByName.get(envName) || new Set();
        current.add(file);
        envByName.set(envName, current);
      }
    }
    if ((EXECUTABLE_PATH_PATTERN.test(file) || file === "package.json") && (MUTATION_COMMAND_PATTERN.test(line) || NODE_MUTATION_COMMAND_PATTERN.test(line)) && !/\bconsole\.(log|warn|error)\s*\(/.test(line)) {
      unsafeCommands.push({ file, line: line.trim() });
    }
  }

  const env = [...envByName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, files]) => classifyEnvironmentName(name, { files: [...files] }));

  return {
    env,
    filesystemWrites,
    unsafeCommands,
    vercelReferences: uniqueEntries(vercelReferences.sort(byFileLine))
  };
}

export function extractEnvNames(line = "") {
  const names = new Set();
  const text = String(line || "");
  for (const match of text.matchAll(/\bprocess\.env\.([A-Z0-9_]+)/g)) names.add(match[1]);
  for (const match of text.matchAll(/\bimport\.meta\.env\.([A-Z0-9_]+)/g)) names.add(match[1]);
  return [...names].sort();
}

export function platformTargetProfile(target = "", evidence = {}) {
  const normalizedTarget = String(target || "").trim();
  if (!PLATFORM_TARGETS.includes(normalizedTarget)) {
    return {
      target: normalizedTarget,
      status: "NOT_VERIFIED",
      confidence: "none",
      ok: false,
      blockers: ["unsupported_target"],
      codeChanges: [],
      externalConfiguration: []
    };
  }

  const hasProductionApiEntrypoint = Boolean(evidence.hasProductionApiEntrypoint);
  const hasStaticServer = Boolean(evidence.hasStaticServer);
  const hasHealthEndpoint = Boolean(evidence.hasHealthEndpoint);
  const hasVersionStrategy = Boolean(evidence.hasVersionStrategy);
  const apiRouteCount = Number(evidence.apiRouteCount || 0);

  if (normalizedTarget === "vercel") {
    return {
      target: normalizedTarget,
      status: "READY",
      confidence: "high",
      ok: hasHealthEndpoint && hasVersionStrategy && apiRouteCount > 0,
      blockers: [],
      codeChanges: [],
      externalConfiguration: ["production env variables", "project security headers", "manifest rewrite"]
    };
  }

  const needsApiAdapter = apiRouteCount > 0 && !hasProductionApiEntrypoint;
  const blockers = [];
  if (needsApiAdapter) blockers.push("node_api_adapter_missing");
  if (!hasStaticServer) blockers.push("static_asset_server_missing");
  if (!hasHealthEndpoint) blockers.push("health_endpoint_missing");
  if (!hasVersionStrategy) blockers.push("version_endpoint_missing");

  const proxyRequirement = normalizedTarget === "docker"
    ? "reverse proxy must terminate HTTPS and preserve Host/Cookie headers"
    : "platform proxy must preserve Host/Cookie headers and run with NODE_ENV=production";

  return {
    target: normalizedTarget,
    status: blockers.length ? "SMALL_ADAPTER_REQUIRED" : "READY_WITH_CONFIG",
    confidence: blockers.length ? "medium" : "not_verified",
    ok: blockers.length === 0,
    blockers,
    codeChanges: needsApiAdapter ? ["add a Node HTTP adapter that maps /api/* to existing handlers and serves dist with SPA fallback"] : [],
    externalConfiguration: [
      "set runtime env variables by name on the target platform",
      "set CMMS_BUILD_COMMIT or equivalent version injection",
      proxyRequirement
    ]
  };
}

export function buildPlatformVerificationReport({
  target = "vercel",
  packageJson = {},
  files = [],
  entries = [],
  buildResult = { attempted: false, ok: false, skipped: false, error: "build_not_checked" },
  nodeVersion = "",
  gitCommit = ""
} = {}) {
  const normalizedFiles = files.map(normalizePath).sort();
  const apiFiles = normalizedFiles.filter((file) => file.startsWith("api/") && /\.js$/.test(file));
  const hasVercelJson = normalizedFiles.includes("vercel.json");
  const hasHealthEndpoint = normalizedFiles.includes("api/health.js") && normalizedFiles.includes("server/health/handler.js");
  const hasVersionStrategy = normalizedFiles.includes("vite.config.js");
  const hasStaticServer = normalizedFiles.includes("tools/static-server.cjs");
  const hasProductionApiEntrypoint = Boolean(packageJson.scripts?.start) || normalizedFiles.some((file) => /^server\/(index|app|main)\.[cm]?js$/.test(file));
  const inventory = scanPlatformInventory(entries);
  const profile = platformTargetProfile(target, {
    apiRouteCount: apiFiles.length,
    hasHealthEndpoint,
    hasProductionApiEntrypoint,
    hasStaticServer,
    hasVersionStrategy
  });
  const requiredScripts = {
    build: Boolean(packageJson.scripts?.build),
    start: Boolean(packageJson.scripts?.start),
    serve: Boolean(packageJson.scripts?.serve),
    test: Boolean(packageJson.scripts?.test),
    lint: Boolean(packageJson.scripts?.lint)
  };

  const checks = {
    supportedTarget: PLATFORM_TARGETS.includes(target) ? "ok" : "failed",
    nodeRuntime: nodeVersion ? "ok" : "failed",
    buildScript: requiredScripts.build ? "ok" : "failed",
    buildExecution: buildResult.skipped ? "skipped" : (buildResult.ok ? "ok" : "failed"),
    apiRoutes: apiFiles.length > 0 ? "vercel-functions" : "missing",
    productionNodeEntrypoint: hasProductionApiEntrypoint ? "ok" : "adapter_required",
    healthEndpoint: hasHealthEndpoint ? "ok" : "failed",
    versionStrategy: hasVersionStrategy ? "ok" : "failed",
    persistentFilesystemWrites: inventory.filesystemWrites.some((entry) => entry.classification === "PORTABILITY_RISK") ? "failed" : "ok",
    noDeploymentCommands: inventory.unsafeCommands.length ? "failed" : "ok",
    noProductionWrites: "ok",
    noSecretValues: "ok"
  };

  const report = {
    ok: profile.ok && checks.buildScript === "ok" && checks.buildExecution === "ok" && checks.healthEndpoint === "ok" && checks.versionStrategy === "ok" && checks.noDeploymentCommands === "ok",
    status: profile.status,
    target,
    gitCommit: shortSha(gitCommit),
    nodeVersion,
    packageManager: "npm",
    scripts: requiredScripts,
    runtime: {
      apiRouteCount: apiFiles.length,
      hasVercelJson,
      hasProductionApiEntrypoint,
      hasStaticServer,
      healthEndpoint: hasHealthEndpoint,
      versionStrategy: hasVersionStrategy
    },
    checks,
    build: {
      attempted: Boolean(buildResult.attempted),
      ok: Boolean(buildResult.ok),
      skipped: Boolean(buildResult.skipped),
      error: buildResult.ok || buildResult.skipped ? "" : String(buildResult.error || "build_failed")
    },
    inventory,
    targetProfile: profile,
    safety: {
      deploys: false,
      mutatesProduction: false,
      printsSecretValues: false,
      networkCalls: false
    }
  };

  if (!PLATFORM_TARGETS.includes(target)) {
    report.ok = false;
    report.status = "NOT_VERIFIED";
  }
  return sortStable(report);
}

function extractShortLine(line = "") {
  return String(line || "").trim().replace(/\s+/g, " ");
}

function byFileLine(a, b) {
  return `${a.file}:${extractShortLine(a.line)}`.localeCompare(`${b.file}:${extractShortLine(b.line)}`);
}

function normalizePath(file = "") {
  return String(file || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function shortSha(value = "") {
  const text = String(value || "").trim();
  return /^[a-f0-9]{7,40}$/i.test(text) ? text.slice(0, 7) : text;
}

function uniqueEntries(entries = []) {
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    const key = `${entry.file}\0${entry.line}\0${entry.classification}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}
