import { describe, expect, it } from "vitest";
import { productionConfigGate } from "../src/productionConfigGateModel.js";

describe("productionConfigGateModel", () => {
  it("allows the default demo/local configuration", () => {
    expect(productionConfigGate()).toMatchObject({
      ok: true,
      appMode: "demo",
      storageProvider: "local",
      errors: []
    });
  });

  it("blocks production mode when local browser storage is still selected", () => {
    expect(productionConfigGate({ appMode: "production", storageProvider: "local" })).toMatchObject({
      ok: false,
      errors: ["production_requires_api_storage_provider"]
    });
  });

  it("blocks production mode when api storage has no backend url", () => {
    expect(productionConfigGate({ appMode: "production", storageProvider: "api" })).toMatchObject({
      ok: false,
      errors: ["production_requires_storage_api_url"]
    });
  });

  it("blocks production api storage when server-side Supabase KV env is missing", () => {
    expect(productionConfigGate({
      appMode: "production",
      storageProvider: "api",
      storageApiBaseUrl: "https://cmms.example/api"
    })).toMatchObject({
      ok: false,
      errors: [
        "production_requires_supabase_kv_auth",
        "production_requires_supabase_kv_driver",
        "production_requires_supabase_url",
        "production_requires_supabase_anon_key",
        "production_requires_supabase_service_role_key",
        "production_requires_supabase_file_storage",
        "production_requires_file_storage_bucket"
      ]
    });
  });

  it("blocks production mode when file storage is not configured", () => {
    expect(productionConfigGate({
      appMode: "production",
      storageProvider: "api",
      storageApiBaseUrl: "https://cmms.example/api",
      kvServer: {
        auth: "supabase",
        driver: "supabase",
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon",
        supabaseServiceRoleKey: "service"
      }
    })).toMatchObject({
      ok: false,
      errors: [
        "production_requires_supabase_file_storage",
        "production_requires_file_storage_bucket"
      ]
    });
  });

  it("allows production mode only after api storage, Supabase KV, and file storage are configured", () => {
    expect(productionConfigGate({
      appMode: "production",
      storageProvider: "api",
      storageApiBaseUrl: "https://cmms.example/api",
      kvServer: {
        auth: "supabase",
        driver: "supabase",
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon",
        supabaseServiceRoleKey: "service"
      },
      fileStorage: {
        driver: "supabase",
        bucket: "cmms-files",
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service"
      }
    })).toMatchObject({
      ok: true,
      errors: [],
      warnings: ["server_auth_rls_files_and_ai_still_require_backend_implementation"]
    });
  });
});
