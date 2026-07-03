import { describe, expect, it } from "vitest";
import {
  STORAGE_PROVIDERS,
  storageApiBaseUrlFromEnv,
  storageProviderFromEnv,
  storageProviderPolicy
} from "../src/storageProviderModel.js";

describe("storageProviderModel", () => {
  it("defaults to local storage when no provider is configured", () => {
    expect(storageProviderFromEnv({})).toBe(STORAGE_PROVIDERS.local);
  });

  it("reads the api provider and trims the api base url", () => {
    expect(storageProviderFromEnv({ VITE_CMMS_STORAGE_PROVIDER: "api" })).toBe(STORAGE_PROVIDERS.api);
    expect(storageApiBaseUrlFromEnv({ VITE_CMMS_STORAGE_API_URL: "https://cmms.example/api///" })).toBe("https://cmms.example/api");
  });

  it("marks production local storage as not ready for production data", () => {
    expect(storageProviderPolicy({ appMode: "production", provider: STORAGE_PROVIDERS.local })).toMatchObject({
      requiresBackend: true,
      usesLocalBrowserStorage: true,
      readyForProductionData: false,
      missingReason: "production_requires_api_storage_provider"
    });
  });

  it("requires an api url when production uses the api provider", () => {
    expect(storageProviderPolicy({ appMode: "production", provider: STORAGE_PROVIDERS.api })).toMatchObject({
      readyForProductionData: false,
      missingReason: "production_requires_storage_api_url"
    });
  });

  it("allows production data only when an api provider and url are configured", () => {
    expect(storageProviderPolicy({
      appMode: "production",
      provider: STORAGE_PROVIDERS.api,
      apiBaseUrl: "https://cmms.example/api"
    })).toMatchObject({
      requiresBackend: true,
      usesLocalBrowserStorage: false,
      readyForProductionData: true,
      missingReason: ""
    });
  });
});
