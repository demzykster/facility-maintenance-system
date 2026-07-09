import { APP_MODES } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS } from "./storageProviderModel.js";

export function normalizedPmAuthorityEnabled({ appMode, storageProvider, provider } = {}) {
  return appMode === APP_MODES.production
    && storageProvider === STORAGE_PROVIDERS.api
    && !!provider;
}

export async function pmForAuthority({ kvPm = [], provider = null, normalizedAuthority = false } = {}) {
  if (!normalizedAuthority || typeof provider?.list !== "function") {
    return { pm: kvPm, source: "kv" };
  }
  const response = await provider.list();
  const pm = Array.isArray(response?.tasks) ? response.tasks : [];
  return { pm, source: "normalized" };
}

export function pmAuthorityFailureIssue({ action = "", id = "", message = "" } = {}) {
  return {
    kind: `pm_normalized_${action || "operation"}_failed`,
    action,
    key: id ? `pm:${id}` : "pm:*",
    message: message || "Normalized periodic maintenance operation failed"
  };
}
