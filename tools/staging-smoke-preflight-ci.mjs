#!/usr/bin/env node
import { aiServerConfigFromEnv } from "../src/aiProviderModel.js";
import { appModeFromEnv } from "../src/seedPolicyModel.js";
import { auditConfigFromEnv, fileStorageConfigFromEnv, kvServerConfigFromEnv } from "../src/productionServerConfigModel.js";
import { storageApiBaseUrlFromEnv, storageProviderFromEnv } from "../src/storageProviderModel.js";
import { productionConfigGate } from "../src/productionConfigGateModel.js";
import { STAGING_SMOKE_OPTIONAL_ENV, STAGING_SMOKE_REQUIRED_ENV, stagingSmokePreflightEnvErrors } from "../src/stagingSmokePreflightModel.js";

const ciEnv = Object.freeze({
  VITE_CMMS_APP_MODE: "production",
  VITE_CMMS_STORAGE_PROVIDER: "api",
  VITE_CMMS_STORAGE_API_URL: "/api",
  VITE_SUPABASE_URL: "https://ci-preflight.supabase.co",
  VITE_SUPABASE_ANON_KEY: "ci-anon-key",
  CMMS_KV_AUTH: "supabase",
  CMMS_KV_DRIVER: "supabase",
  CMMS_DATA_AUTHORITY: "normalized",
  CMMS_ALLOW_PRODUCTION_KV_BRIDGE: "true",
  SUPABASE_URL: "https://ci-preflight.supabase.co",
  SUPABASE_ANON_KEY: "ci-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "ci-service-role-key",
  CMMS_FILE_DRIVER: "supabase",
  CMMS_FILE_BUCKET: "cmms-files",
  CMMS_FILE_METADATA_DRIVER: "supabase",
  CMMS_AUDIT_DRIVER: "supabase",
  CMMS_PUBLIC_COMPLAINTS_ENABLED: "true",
  CMMS_PUBLIC_COMPLAINTS_DRIVER: "supabase"
});

const errors = stagingSmokePreflightEnvErrors(ciEnv, {
  requiredNames: STAGING_SMOKE_REQUIRED_ENV,
  placeholderNames: [...STAGING_SMOKE_REQUIRED_ENV, ...STAGING_SMOKE_OPTIONAL_ENV]
});

const appMode = appModeFromEnv(ciEnv);
const storageProvider = storageProviderFromEnv(ciEnv);
const storageApiBaseUrl = storageApiBaseUrlFromEnv(ciEnv);
const kvServer = kvServerConfigFromEnv(ciEnv);
const fileStorage = fileStorageConfigFromEnv(ciEnv);
const audit = auditConfigFromEnv(ciEnv);
const ai = aiServerConfigFromEnv(ciEnv);
const gate = productionConfigGate({ appMode, storageProvider, storageApiBaseUrl, kvServer, fileStorage, audit, ai });

errors.push(...gate.errors.map((error) => `production_config:${error}`));

if (errors.length) {
  console.error("[staging-smoke-ci] preflight contract failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("[staging-smoke-ci] preflight contract ok");
