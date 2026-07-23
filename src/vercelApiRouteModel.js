export const VERCEL_API_ROUTE_FUNCTION_BUDGET = 24;

export const VERCEL_API_ROUTE_FILES = Object.freeze([
  "api/ai/[action].js",
  "api/brand-icon.js",
  "api/bootstrap/admin.js",
  "api/[diagnostic].js",
  "api/cleaning/records.js",
  "api/files/index.js",
  "api/fleet/index.js",
  "api/health.js",
  "api/install.js",
  "api/kv/[key].js",
  "api/kv/index.js",
  "api/manifest.js",
  "api/pm/index.js",
  "api/presence/index.js",
  "api/ppe/index.js",
  "api/public/[resource].js",
  "api/push.js",
  "api/session/[action].js",
  "api/settings/config.js",
  "api/settings/records.js",
  "api/tickets/index.js",
  "api/users/index.js",
  "api/work/index.js"
]);

export function vercelApiRoutePolicy(files = [], { functionLimit = VERCEL_API_ROUTE_FUNCTION_BUDGET } = {}) {
  const apiFiles = [...new Set((files || []).map((file) => String(file || "").replace(/\\/g, "/")))]
    .filter((file) => file.startsWith("api/") && file.endsWith(".js"))
    .sort();
  const allowed = new Set(VERCEL_API_ROUTE_FILES);
  const unexpected = apiFiles.filter((file) => !allowed.has(file));
  const missing = VERCEL_API_ROUTE_FILES.filter((file) => !apiFiles.includes(file));
  const overLimit = apiFiles.length > functionLimit;
  const errors = [];
  if (unexpected.length) errors.push(`unexpected_api_route_files:${unexpected.join(",")}`);
  if (missing.length) errors.push(`missing_api_route_files:${missing.join(",")}`);
  if (overLimit) errors.push(`api_route_count_exceeds_limit:${apiFiles.length}/${functionLimit}`);
  return {
    ok: errors.length === 0,
    apiFiles,
    expected: VERCEL_API_ROUTE_FILES,
    unexpected,
    missing,
    functionLimit,
    errors
  };
}
