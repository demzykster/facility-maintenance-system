import { aiServerConfigFromEnv } from "../src/aiProviderModel.js";
import { appModeFromEnv } from "../src/seedPolicyModel.js";
import { auditConfigFromEnv, fileStorageConfigFromEnv, kvServerConfigFromEnv } from "../src/productionServerConfigModel.js";
import { storageApiBaseUrlFromEnv, storageProviderFromEnv } from "../src/storageProviderModel.js";
import { productionConfigGate } from "../src/productionConfigGateModel.js";
import { STAGING_SMOKE_OPTIONAL_ENV, STAGING_SMOKE_REQUIRED_ENV, stagingSmokePreflightEnvErrors } from "../src/stagingSmokePreflightModel.js";

const present = (name) => String(process.env[name] || "").trim() !== "";
const errors = stagingSmokePreflightEnvErrors(process.env, {
  requiredNames: STAGING_SMOKE_REQUIRED_ENV,
  placeholderNames: [...STAGING_SMOKE_REQUIRED_ENV, ...STAGING_SMOKE_OPTIONAL_ENV]
});
const warnings = [];

for (const name of STAGING_SMOKE_OPTIONAL_ENV) {
  if (!present(name)) warnings.push(`optional_env_not_set:${name}`);
}

const appMode = appModeFromEnv(process.env);
const storageProvider = storageProviderFromEnv(process.env);
const storageApiBaseUrl = storageApiBaseUrlFromEnv(process.env);
const kvServer = kvServerConfigFromEnv(process.env);
const fileStorage = fileStorageConfigFromEnv(process.env);
const audit = auditConfigFromEnv(process.env);
const ai = aiServerConfigFromEnv(process.env);
const gate = productionConfigGate({ appMode, storageProvider, storageApiBaseUrl, kvServer, fileStorage, audit, ai });

errors.push(...gate.errors.map((error) => `production_config:${error}`));
warnings.push(...gate.warnings.map((warning) => `production_config:${warning}`));

const summary = {
  ok: errors.length === 0,
  appMode,
  storageProvider,
  storageApiConfigured: Boolean(storageApiBaseUrl),
  supabaseConfigured: Boolean(kvServer.supabaseUrl && kvServer.supabaseAnonKey && kvServer.supabaseServiceRoleKey),
  fileStorageConfigured: Boolean(fileStorage.driver && fileStorage.bucket && fileStorage.metadataDriver),
  auditConfigured: Boolean(audit.driver),
  publicComplaintsConfigured: process.env.CMMS_PUBLIC_COMPLAINTS_ENABLED === "true" && process.env.CMMS_PUBLIC_COMPLAINTS_DRIVER === "supabase",
  bootstrapDisabled: !present("CMMS_BOOTSTRAP_TOKEN") && (!present("CMMS_BOOTSTRAP_ENABLED") || process.env.CMMS_BOOTSTRAP_ENABLED === "false"),
  aiMode: ai.mode,
  warnings,
  errors
};

for (const warning of warnings) console.warn(`[staging-smoke] warning: ${warning}`);

if (!summary.ok) {
  console.error("[staging-smoke] preflight failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("[staging-smoke] preflight ok");
console.log(JSON.stringify(summary, null, 2));
