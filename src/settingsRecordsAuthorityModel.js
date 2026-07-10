import { APP_MODES } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS } from "./storageProviderModel.js";

export function normalizedSettingsRecordsAuthorityEnabled({ appMode, storageProvider, provider } = {}) {
  return appMode === APP_MODES.production
    && storageProvider === STORAGE_PROVIDERS.api
    && !!provider;
}

export async function settingsRecordsForAuthority({
  kvLocations = [],
  kvAppIssues = [],
  provider = null,
  normalizedAuthority = false
} = {}) {
  if (!normalizedAuthority || !provider) {
    return { locations: kvLocations, appIssues: kvAppIssues, source: "kv" };
  }

  const [locations, appIssues] = await Promise.all([
    provider.locations?.list?.(),
    provider.appIssues?.list?.()
  ]);

  return {
    locations: Array.isArray(locations?.locations) ? locations.locations : [],
    appIssues: Array.isArray(appIssues?.appIssues) ? appIssues.appIssues : [],
    source: "normalized"
  };
}

export function settingsRecordsAuthorityFailureIssue({ action = "", resource = "", id = "", message = "" } = {}) {
  const normalizedResource = resource || "records";
  return {
    kind: `settings_${normalizedResource}_normalized_${action || "operation"}_failed`,
    action,
    key: id ? `settings:${normalizedResource}:${id}` : `settings:${normalizedResource}:*`,
    message: message || "Normalized settings-record operation failed"
  };
}
