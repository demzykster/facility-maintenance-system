export const STAGING_SUPABASE_TABLES = [
  "app_users",
  "cmms_kv_records",
  "cleaning_zones",
  "cleaning_rounds",
  "cleaning_complaints",
  "fleet_units",
  "worker_absences",
  "periodic_maintenance",
  "tickets",
  "file_metadata",
  "audit_events"
];

export function requiredSupabaseSchemaEnv() {
  return ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CMMS_FILE_BUCKET"];
}

export function missingSupabaseSchemaEnv(env = {}) {
  return requiredSupabaseSchemaEnv().filter((name) => !String(env[name] || "").trim());
}

export function normalizeSupabaseUrl(url = "") {
  return String(url || "").trim().replace(/\/+$/, "");
}

export function supabaseSchemaCheckSummary({ tables = [], bucket = null, errors = [] } = {}) {
  return {
    ok: errors.length === 0,
    tables: tables.map((item) => ({ name: item.name, ok: Boolean(item.ok), status: item.status || null })),
    bucket: bucket ? { name: bucket.name, ok: Boolean(bucket.ok), private: bucket.private === true, status: bucket.status || null } : null,
    errors
  };
}
