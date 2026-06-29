export const VERCEL_HOBBY_FUNCTION_LIMIT = 12;

export const VERCEL_API_ROUTE_FILES = Object.freeze([
  "api/bootstrap/admin.js",
  "api/client-errors.js",
  "api/files/index.js",
  "api/kv/[key].js",
  "api/kv/index.js",
  "api/public/complaints.js",
  "api/session/change-password.js",
  "api/session/profile.js",
  "api/session/me.js",
  "api/system-errors.js"
]);

export function vercelApiRoutePolicy(files = [], { functionLimit = VERCEL_HOBBY_FUNCTION_LIMIT } = {}) {
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
