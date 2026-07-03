export const STORAGE_PROVIDERS = Object.freeze({
  local: "local",
  api: "api"
});

export function storageProviderFromEnv(env = {}) {
  const value = String(env?.VITE_CMMS_STORAGE_PROVIDER || "").trim().toLowerCase();
  return Object.values(STORAGE_PROVIDERS).includes(value) ? value : STORAGE_PROVIDERS.local;
}

export function storageApiBaseUrlFromEnv(env = {}) {
  return String(env?.VITE_CMMS_STORAGE_API_URL || "").trim().replace(/\/+$/, "");
}

export function storageProviderPolicy({ appMode = "demo", provider = STORAGE_PROVIDERS.local, apiBaseUrl = "" } = {}) {
  const production = appMode === "production";
  const api = provider === STORAGE_PROVIDERS.api;
  return {
    appMode,
    provider,
    apiBaseUrl,
    requiresBackend: production,
    usesLocalBrowserStorage: !api,
    readyForProductionData: production ? api && !!apiBaseUrl : true,
    missingReason: production && !api
      ? "production_requires_api_storage_provider"
      : production && !apiBaseUrl
        ? "production_requires_storage_api_url"
        : ""
  };
}
