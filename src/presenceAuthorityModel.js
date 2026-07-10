import { APP_MODES } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS } from "./storageProviderModel.js";

export function normalizedPresenceAuthorityEnabled({ appMode, storageProvider, provider } = {}) {
  return appMode === APP_MODES.production
    && storageProvider === STORAGE_PROVIDERS.api
    && !!provider;
}

export async function presenceForAuthority({ kvPresence = [], provider = null, normalizedAuthority = false } = {}) {
  if (!normalizedAuthority || typeof provider?.list !== "function") {
    return { presence: kvPresence, source: "kv" };
  }

  const response = await provider.list();
  return {
    presence: Array.isArray(response?.presence) ? response.presence : [],
    source: "normalized"
  };
}

export function presenceAuthorityFailureIssue({ action = "", id = "", message = "" } = {}) {
  return {
    kind: `presence_normalized_${action || "operation"}_failed`,
    action,
    key: id ? `presence:${id}` : "presence:*",
    message: message || "Normalized presence operation failed"
  };
}
