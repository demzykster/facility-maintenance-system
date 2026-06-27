import { APP_MODES, seedPolicyForMode } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS, storageProviderPolicy } from "./storageProviderModel.js";
import { productionFileStoragePolicy, productionKvServerPolicy } from "./productionServerConfigModel.js";

const pushUnique = (target, values) => {
  for (const value of values) {
    if (!target.includes(value)) target.push(value);
  }
};

export function productionConfigGate({
  appMode = APP_MODES.demo,
  storageProvider = STORAGE_PROVIDERS.local,
  storageApiBaseUrl = "",
  kvServer = {},
  fileStorage = {}
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
  const fileStoragePolicy = storagePolicy.readyForProductionData
    ? productionFileStoragePolicy({
      appMode,
      fileStorage: {
        supabaseUrl: kvServer.supabaseUrl,
        supabaseServiceRoleKey: kvServer.supabaseServiceRoleKey,
        ...fileStorage
      }
    })
    : { requiresFileStorage: false, ok: true, errors: [] };
  const errors = [];
  const warnings = [];

  if (appMode === APP_MODES.production) {
    if (seedPolicy.allowDemoData) errors.push("production_must_disable_demo_data");
    if (seedPolicy.allowBuiltinDemoUsers) errors.push("production_must_disable_builtin_demo_users");
    if (!storagePolicy.readyForProductionData) errors.push(storagePolicy.missingReason || "production_storage_not_ready");
    pushUnique(errors, kvServerPolicy.errors);
    pushUnique(errors, fileStoragePolicy.errors);
    warnings.push("server_auth_rls_files_and_ai_still_require_backend_implementation");
  }

  return {
    ok: errors.length === 0,
    appMode,
    storageProvider,
    errors,
    warnings,
    kvServer: kvServerPolicy,
    fileStorage: fileStoragePolicy
  };
}
