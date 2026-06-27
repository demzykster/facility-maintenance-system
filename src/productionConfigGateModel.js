import { APP_MODES, seedPolicyForMode } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS, storageProviderPolicy } from "./storageProviderModel.js";
import { productionKvServerPolicy } from "./productionServerConfigModel.js";

export function productionConfigGate({
  appMode = APP_MODES.demo,
  storageProvider = STORAGE_PROVIDERS.local,
  storageApiBaseUrl = "",
  kvServer = {}
} = {}) {
  const seedPolicy = seedPolicyForMode(appMode);
  const storagePolicy = storageProviderPolicy({
    appMode,
    provider: storageProvider,
    apiBaseUrl: storageApiBaseUrl
  });
  const kvServerPolicy = storagePolicy.readyForProductionData
    ? productionKvServerPolicy({ appMode, storageProvider, kvServer })
    : { requiresProductionKv: false, ok: true, errors: [] };
  const errors = [];
  const warnings = [];

  if (appMode === APP_MODES.production) {
    if (seedPolicy.allowDemoData) errors.push("production_must_disable_demo_data");
    if (seedPolicy.allowBuiltinDemoUsers) errors.push("production_must_disable_builtin_demo_users");
    if (!storagePolicy.readyForProductionData) errors.push(storagePolicy.missingReason || "production_storage_not_ready");
    errors.push(...kvServerPolicy.errors);
    warnings.push("server_auth_rls_files_and_ai_still_require_backend_implementation");
  }

  return {
    ok: errors.length === 0,
    appMode,
    storageProvider,
    errors,
    warnings,
    kvServer: kvServerPolicy
  };
}
