export function kvServerConfigFromEnv(env = {}) {
  return {
    auth: String(env.CMMS_KV_AUTH || "").trim().toLowerCase(),
    driver: String(env.CMMS_KV_DRIVER || "").trim().toLowerCase(),
    supabaseUrl: String(env.SUPABASE_URL || "").trim(),
    supabaseAnonKey: String(env.SUPABASE_ANON_KEY || "").trim(),
    supabaseServiceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  };
}

export function productionKvServerPolicy({
  appMode = "demo",
  storageProvider = "local",
  kvServer = {}
} = {}) {
  const requiresProductionKv = appMode === "production" && storageProvider === "api";
  const errors = [];

  if (requiresProductionKv) {
    if (kvServer.auth !== "supabase") errors.push("production_requires_supabase_kv_auth");
    if (kvServer.driver !== "supabase") errors.push("production_requires_supabase_kv_driver");
    if (!kvServer.supabaseUrl) errors.push("production_requires_supabase_url");
    if (!kvServer.supabaseAnonKey) errors.push("production_requires_supabase_anon_key");
    if (!kvServer.supabaseServiceRoleKey) errors.push("production_requires_supabase_service_role_key");
  }

  return {
    requiresProductionKv,
    ok: errors.length === 0,
    errors
  };
}
