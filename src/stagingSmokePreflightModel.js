export const STAGING_SMOKE_REQUIRED_ENV = [
  "VITE_CMMS_APP_MODE",
  "VITE_CMMS_STORAGE_PROVIDER",
  "VITE_CMMS_STORAGE_API_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "CMMS_KV_AUTH",
  "CMMS_KV_DRIVER",
  "CMMS_DATA_AUTHORITY",
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
const present = (env = {}, name) => clean(env[name]) !== "";

const EXPECTED_STAGING_ENV = Object.freeze([
  ["VITE_CMMS_APP_MODE", "production", "staging_smoke_requires_production_app_mode"],
  ["VITE_CMMS_STORAGE_PROVIDER", "api", "staging_smoke_requires_api_storage_provider"],
  ["CMMS_KV_AUTH", "supabase", "staging_smoke_requires_supabase_kv_auth"],
  ["CMMS_KV_DRIVER", "supabase", "staging_smoke_requires_supabase_kv_driver"],
  ["CMMS_DATA_AUTHORITY", "normalized", "staging_smoke_requires_normalized_data_authority"],
  ["CMMS_FILE_DRIVER", "supabase", "staging_smoke_requires_supabase_file_driver"],
  ["CMMS_FILE_METADATA_DRIVER", "supabase", "staging_smoke_requires_supabase_file_metadata_driver"],
  ["CMMS_AUDIT_DRIVER", "supabase", "staging_smoke_requires_supabase_audit_driver"],
  ["CMMS_PUBLIC_COMPLAINTS_ENABLED", "true", "staging_smoke_requires_public_complaints_enabled"],
  ["CMMS_PUBLIC_COMPLAINTS_DRIVER", "supabase", "staging_smoke_requires_public_complaints_supabase_driver"]
]);

export function stagingMissingRequiredEnvErrors(env = {}, names = STAGING_SMOKE_REQUIRED_ENV) {
  const errors = [];
  for (const name of names) {
    if (!present(env, name)) errors.push(`missing_env:${name}`);
  }
  return errors;
}

export function stagingWrongValueEnvErrors(env = {}) {
  const errors = [];
  for (const [name, expected, error] of EXPECTED_STAGING_ENV) {
    if (present(env, name) && clean(env[name]) !== expected) errors.push(error);
  }
  return errors;
}

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

export function stagingBootstrapEnvErrors(env = {}) {
  const errors = [];
  if (present(env, "CMMS_BOOTSTRAP_ENABLED") && clean(env.CMMS_BOOTSTRAP_ENABLED) !== "false") {
    errors.push("bootstrap_must_be_disabled_after_first_admin");
  }
  if (present(env, "CMMS_BOOTSTRAP_TOKEN")) {
    errors.push("bootstrap_token_must_be_removed_after_first_admin");
  }
  return errors;
}

export function stagingSmokePreflightEnvErrors(env = {}, {
  requiredNames = STAGING_SMOKE_REQUIRED_ENV,
  placeholderNames = STAGING_SMOKE_REQUIRED_ENV
} = {}) {
  return [
    ...stagingMissingRequiredEnvErrors(env, requiredNames),
    ...stagingWrongValueEnvErrors(env),
    ...stagingSupabaseEnvPairErrors(env),
    ...stagingPlaceholderEnvErrors(env, placeholderNames),
    ...stagingBootstrapEnvErrors(env)
  ];
}
