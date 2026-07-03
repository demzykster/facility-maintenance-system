export const STAGING_SMOKE_REQUIRED_ENV = [
  "VITE_CMMS_APP_MODE",
  "VITE_CMMS_STORAGE_PROVIDER",
  "VITE_CMMS_STORAGE_API_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "CMMS_KV_AUTH",
  "CMMS_KV_DRIVER",
  "CMMS_ALLOW_PRODUCTION_KV_BRIDGE",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CMMS_FILE_DRIVER",
  "CMMS_FILE_BUCKET",
  "CMMS_FILE_METADATA_DRIVER",
  "CMMS_AUDIT_DRIVER",
  "CMMS_PUBLIC_COMPLAINTS_ENABLED",
  "CMMS_PUBLIC_COMPLAINTS_DRIVER"
];

export const STAGING_SMOKE_OPTIONAL_ENV = [
  "CMMS_KV_SUPABASE_TABLE",
  "CMMS_FILE_METADATA_SUPABASE_TABLE",
  "CMMS_AUDIT_SUPABASE_TABLE",
  "CMMS_PUBLIC_COMPLAINT_RATE_LIMIT_MS",
  "VITE_CMMS_PUBLIC_COMPLAINT_API_URL"
];

const clean = (value) => String(value || "").trim();
const cleanUrl = (value) => clean(value).replace(/\/+$/, "");

export function stagingPlaceholderEnvErrors(env = {}, names = STAGING_SMOKE_REQUIRED_ENV) {
  const errors = [];
  for (const name of names) {
    const value = clean(env[name]);
    if (!value) continue;
    const upper = value.toUpperCase();
    if (
      upper.includes("YOUR_") ||
      upper.includes("YOUR-") ||
      upper.includes("YOUR_PROJECT") ||
      upper.includes("REPLACE_WITH") ||
      upper.includes("CHANGE_ME")
    ) {
      errors.push(`placeholder_env:${name}`);
    }
  }
  return errors;
}

export function stagingSupabaseEnvPairErrors(env = {}) {
  const errors = [];
  const publicUrl = cleanUrl(env.VITE_SUPABASE_URL);
  const serverUrl = cleanUrl(env.SUPABASE_URL);
  const publicAnonKey = clean(env.VITE_SUPABASE_ANON_KEY);
  const serverAnonKey = clean(env.SUPABASE_ANON_KEY);

  if (publicUrl && serverUrl && publicUrl !== serverUrl) {
    errors.push("staging_smoke_requires_matching_public_and_server_supabase_url");
  }
  if (publicAnonKey && serverAnonKey && publicAnonKey !== serverAnonKey) {
    errors.push("staging_smoke_requires_matching_public_and_server_supabase_anon_key");
  }

  return errors;
}
