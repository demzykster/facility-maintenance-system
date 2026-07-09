import { APP_MODES } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS } from "./storageProviderModel.js";

export function normalizedCleaningZonesAuthorityEnabled({ appMode, storageProvider, provider } = {}) {
  return appMode === APP_MODES.production
    && storageProvider === STORAGE_PROVIDERS.api
    && !!provider;
}

export async function cleaningZonesForAuthority({ kvZones = [], provider = null, normalizedAuthority = false } = {}) {
  if (!normalizedAuthority || typeof provider?.list !== "function") {
    return { zones: kvZones, source: "kv" };
  }
  const response = await provider.list();
  const zones = Array.isArray(response?.zones) ? response.zones : [];
  return { zones, source: "normalized" };
}

export function cleaningZonesAuthorityFailureIssue({ action = "", id = "", message = "" } = {}) {
  return {
    kind: `cleaning_zones_normalized_${action || "operation"}_failed`,
    action,
    key: id ? `czone:${id}` : "czone:*",
    message: message || "Normalized cleaning zones operation failed"
  };
}
