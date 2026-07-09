import { APP_MODES } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS } from "./storageProviderModel.js";

export function normalizedCleaningRoundsAuthorityEnabled({ appMode, storageProvider, provider } = {}) {
  return appMode === APP_MODES.production
    && storageProvider === STORAGE_PROVIDERS.api
    && !!provider;
}

export async function cleaningRoundsForAuthority({ kvRounds = [], provider = null, normalizedAuthority = false } = {}) {
  if (!normalizedAuthority || typeof provider?.list !== "function") {
    return { rounds: kvRounds, source: "kv" };
  }
  const response = await provider.list();
  const rounds = Array.isArray(response?.rounds) ? response.rounds : [];
  return { rounds, source: "normalized" };
}

export function cleaningRoundsAuthorityFailureIssue({ action = "", id = "", message = "" } = {}) {
  return {
    kind: `cleaning_rounds_normalized_${action || "operation"}_failed`,
    action,
    key: id ? `cround:${id}` : "cround:*",
    message: message || "Normalized cleaning rounds operation failed"
  };
}
