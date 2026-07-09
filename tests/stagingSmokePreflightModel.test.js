import { describe, expect, it } from "vitest";
import {
  STAGING_SMOKE_OPTIONAL_ENV,
  STAGING_SMOKE_REQUIRED_ENV,
  stagingBootstrapEnvErrors,
  stagingMissingRequiredEnvErrors,
  stagingPlaceholderEnvErrors,
  stagingSmokePreflightEnvErrors,
  stagingSupabaseEnvPairErrors,
  stagingWrongValueEnvErrors
} from "../src/stagingSmokePreflightModel.js";

describe("staging smoke preflight model", () => {
  it("requires both browser-visible and server-side Supabase env", () => {
    expect(STAGING_SMOKE_REQUIRED_ENV).toEqual(expect.arrayContaining([
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY"
    ]));
  });

  it("requires public and server Supabase env to point at the same project", () => {
    expect(stagingSupabaseEnvPairErrors({
      VITE_SUPABASE_URL: "https://supabase.example/",
      SUPABASE_URL: "https://supabase.example",
      VITE_SUPABASE_ANON_KEY: "anon",
      SUPABASE_ANON_KEY: "anon"
    })).toEqual([]);

    expect(stagingSupabaseEnvPairErrors({
      VITE_SUPABASE_URL: "https://public.example",
      SUPABASE_URL: "https://server.example",
      VITE_SUPABASE_ANON_KEY: "public-anon",
      SUPABASE_ANON_KEY: "server-anon"
    })).toEqual([
      "staging_smoke_requires_matching_public_and_server_supabase_url",
      "staging_smoke_requires_matching_public_and_server_supabase_anon_key"
    ]);
  });

  it("rejects placeholder values copied from the staging example", () => {
    expect(stagingPlaceholderEnvErrors({
      VITE_SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
      VITE_SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
      SUPABASE_SERVICE_ROLE_KEY: "REPLACE_WITH_ONE_TIME_RANDOM_TOKEN",
      CMMS_FILE_BUCKET: "cmms-files"
    }, ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CMMS_FILE_BUCKET"])).toEqual([
      "placeholder_env:VITE_SUPABASE_URL",
      "placeholder_env:VITE_SUPABASE_ANON_KEY",
      "placeholder_env:SUPABASE_SERVICE_ROLE_KEY"
    ]);
  });

  it("accepts non-placeholder staging values", () => {
    expect(stagingPlaceholderEnvErrors({
      VITE_SUPABASE_URL: "https://abc123.supabase.co",
      VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      CMMS_FILE_BUCKET: "cmms-files"
    }, ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "CMMS_FILE_BUCKET"])).toEqual([]);
  });

  it("reports missing required staging env values", () => {
    expect(stagingMissingRequiredEnvErrors({}, ["VITE_CMMS_APP_MODE", "SUPABASE_URL"])).toEqual([
      "missing_env:VITE_CMMS_APP_MODE",
      "missing_env:SUPABASE_URL"
    ]);

    expect(stagingMissingRequiredEnvErrors({ VITE_CMMS_APP_MODE: "production" }, ["VITE_CMMS_APP_MODE"])).toEqual([]);
  });

  it("reports wrong staging env values when present", () => {
    expect(stagingWrongValueEnvErrors({
      VITE_CMMS_APP_MODE: "demo",
      VITE_CMMS_STORAGE_PROVIDER: "local",
      CMMS_KV_AUTH: "none",
      CMMS_KV_DRIVER: "upstash",
      CMMS_FILE_DRIVER: "local",
      CMMS_FILE_METADATA_DRIVER: "none",
      CMMS_AUDIT_DRIVER: "console",
      CMMS_PUBLIC_COMPLAINTS_ENABLED: "false",
      CMMS_PUBLIC_COMPLAINTS_DRIVER: "kv"
    })).toEqual([
      "staging_smoke_requires_production_app_mode",
      "staging_smoke_requires_api_storage_provider",
      "staging_smoke_requires_supabase_kv_auth",
      "staging_smoke_requires_supabase_kv_driver",
      "staging_smoke_requires_supabase_file_driver",
      "staging_smoke_requires_supabase_file_metadata_driver",
      "staging_smoke_requires_supabase_audit_driver",
      "staging_smoke_requires_public_complaints_enabled",
      "staging_smoke_requires_public_complaints_supabase_driver"
    ]);

    expect(stagingWrongValueEnvErrors({})).toEqual([]);
  });

  it("reports bootstrap env that must be removed after first admin setup", () => {
    expect(stagingBootstrapEnvErrors({
      CMMS_BOOTSTRAP_ENABLED: "true",
      CMMS_BOOTSTRAP_TOKEN: "secret"
    })).toEqual([
      "bootstrap_must_be_disabled_after_first_admin",
      "bootstrap_token_must_be_removed_after_first_admin"
    ]);

    expect(stagingBootstrapEnvErrors({ CMMS_BOOTSTRAP_ENABLED: "false" })).toEqual([]);
  });

  it("combines executable preflight env checks in the script order", () => {
    expect(stagingSmokePreflightEnvErrors({
      VITE_CMMS_APP_MODE: "demo",
      VITE_CMMS_STORAGE_PROVIDER: "api",
      VITE_CMMS_STORAGE_API_URL: "/api",
      VITE_SUPABASE_URL: "https://public.example",
      VITE_SUPABASE_ANON_KEY: "public-anon",
      CMMS_KV_AUTH: "supabase",
      CMMS_KV_DRIVER: "supabase",
      CMMS_ALLOW_PRODUCTION_KV_BRIDGE: "true",
      SUPABASE_URL: "https://server.example",
      SUPABASE_ANON_KEY: "server-anon",
      SUPABASE_SERVICE_ROLE_KEY: "REPLACE_WITH_SERVICE_ROLE",
      CMMS_FILE_DRIVER: "supabase",
      CMMS_FILE_BUCKET: "cmms-files",
      CMMS_FILE_METADATA_DRIVER: "supabase",
      CMMS_AUDIT_DRIVER: "supabase",
      CMMS_PUBLIC_COMPLAINTS_ENABLED: "true",
      CMMS_PUBLIC_COMPLAINTS_DRIVER: "supabase",
      CMMS_BOOTSTRAP_TOKEN: "secret"
    }, {
      requiredNames: STAGING_SMOKE_REQUIRED_ENV,
      placeholderNames: [...STAGING_SMOKE_REQUIRED_ENV, ...STAGING_SMOKE_OPTIONAL_ENV]
    })).toEqual([
      "staging_smoke_requires_production_app_mode",
      "staging_smoke_requires_matching_public_and_server_supabase_url",
      "staging_smoke_requires_matching_public_and_server_supabase_anon_key",
      "placeholder_env:SUPABASE_SERVICE_ROLE_KEY",
      "bootstrap_token_must_be_removed_after_first_admin"
    ]);
  });
});
