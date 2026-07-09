import { APP_MODES } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS } from "./storageProviderModel.js";

export function normalizedFleetAuthorityEnabled({ appMode, storageProvider, provider } = {}) {
  return appMode === APP_MODES.production
    && storageProvider === STORAGE_PROVIDERS.api
    && !!provider;
}

export async function fleetForAuthority({ kvFleet = [], provider = null, normalizedAuthority = false } = {}) {
  if (!normalizedAuthority || typeof provider?.list !== "function") {
    return { fleet: kvFleet, source: "kv" };
  }
  const response = await provider.list();
  const fleet = Array.isArray(response?.units) ? response.units : [];
  return { fleet, source: "normalized" };
}

export function fleetAuthorityFailureIssue({ action = "", id = "", message = "" } = {}) {
  return {
    kind: `fleet_normalized_${action || "operation"}_failed`,
    action,
    key: id ? `fleet:${id}` : "fleet:*",
    message: message || "Normalized fleet operation failed"
  };
}
