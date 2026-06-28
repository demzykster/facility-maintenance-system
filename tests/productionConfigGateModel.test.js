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
        "production_requires_explicit_kv_bridge_acceptance",
        "production_requires_supabase_url",
        "production_requires_supabase_anon_key",
        "production_requires_supabase_service_role_key",
        "production_requires_supabase_file_storage",
        "production_requires_file_storage_bucket",
        "production_requires_supabase_file_metadata_driver",
        "production_requires_supabase_audit_driver"
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
        allowKvBridgeProduction: true,
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon",
        supabaseServiceRoleKey: "service"
      }
    })).toMatchObject({
      ok: false,
      errors: [
        "production_requires_supabase_file_storage",
        "production_requires_file_storage_bucket",
        "production_requires_supabase_file_metadata_driver",
        "production_requires_supabase_audit_driver"
      ]
    });
  });

  it("blocks production mode when file metadata storage is not configured", () => {
    expect(productionConfigGate({
      appMode: "production",
      storageProvider: "api",
      storageApiBaseUrl: "https://cmms.example/api",
      kvServer: {
        auth: "supabase",
        driver: "supabase",
        allowKvBridgeProduction: true,
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon",
        supabaseServiceRoleKey: "service"
      },
      fileStorage: {
        driver: "supabase",
        bucket: "cmms-files",
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service"
      },
      audit: {
        driver: "supabase",
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service"
      }
    })).toMatchObject({
      ok: false,
      errors: ["production_requires_supabase_file_metadata_driver"]
    });
  });

  it("blocks production mode when audit storage is not configured", () => {
    expect(productionConfigGate({
      appMode: "production",
      storageProvider: "api",
      storageApiBaseUrl: "https://cmms.example/api",
      kvServer: {
        auth: "supabase",
        driver: "supabase",
        allowKvBridgeProduction: true,
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon",
        supabaseServiceRoleKey: "service"
      },
      fileStorage: {
        driver: "supabase",
        bucket: "cmms-files",
        metadataDriver: "supabase",
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service"
      }
    })).toMatchObject({
      ok: false,
      errors: ["production_requires_supabase_audit_driver"]
    });
  });

  it("blocks production mode until the interim KV bridge is explicitly accepted", () => {
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
        metadataDriver: "supabase",
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service"
      },
      audit: {
        driver: "supabase",
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service"
      }
    })).toMatchObject({
      ok: false,
      errors: ["production_requires_explicit_kv_bridge_acceptance"]
    });
  });

  it("allows production mode only after api storage, accepted Supabase KV bridge, file storage, file metadata, and audit storage are configured", () => {
    expect(productionConfigGate({
      appMode: "production",
      storageProvider: "api",
      storageApiBaseUrl: "https://cmms.example/api",
      kvServer: {
        auth: "supabase",
        driver: "supabase",
        allowKvBridgeProduction: true,
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon",
        supabaseServiceRoleKey: "service"
      },
      fileStorage: {
        driver: "supabase",
        bucket: "cmms-files",
        metadataDriver: "supabase",
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service"
      },
      audit: {
        driver: "supabase",
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service"
      }
    })).toMatchObject({
      ok: true,
      errors: [],
      warnings: ["server_auth_rls_and_normalized_tables_still_require_backend_implementation"]
    });
  });

  it("blocks direct browser AI mode in production", () => {
    expect(productionConfigGate({
      appMode: "production",
      storageProvider: "api",
      storageApiBaseUrl: "https://cmms.example/api",
      kvServer: {
        auth: "supabase",
        driver: "supabase",
        allowKvBridgeProduction: true,
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon",
        supabaseServiceRoleKey: "service"
      },
      fileStorage: {
        driver: "supabase",
        bucket: "cmms-files",
        metadataDriver: "supabase"
      },
      audit: { driver: "supabase" },
      ai: { mode: "client" }
    })).toMatchObject({
      ok: false,
      errors: ["production_forbids_browser_ai_provider_calls"]
    });
  });
});
