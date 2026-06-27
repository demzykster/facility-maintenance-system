import { productionAiPolicy } from "./aiProviderModel.js";
import { APP_MODES, seedPolicyForMode } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS, storageProviderPolicy } from "./storageProviderModel.js";
import { productionAuditPolicy, productionFileStoragePolicy, productionKvServerPolicy } from "./productionServerConfigModel.js";

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
  fileStorage = {},
  audit = {},
  ai = {}
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
  const aiPolicy = productionAiPolicy({ appMode, ai });
  const auditPolicy = storagePolicy.readyForProductionData
    ? productionAuditPolicy({
      appMode,
      audit: {
        supabaseUrl: kvServer.supabaseUrl,
        supabaseServiceRoleKey: kvServer.supabaseServiceRoleKey,
        ...audit
      }
    })
    : { requiresAudit: false, ok: true, errors: [] };
  const errors = [];
  const warnings = [];

  if (appMode === APP_MODES.production) {
    if (seedPolicy.allowDemoData) errors.push("production_must_disable_demo_data");
    if (seedPolicy.allowBuiltinDemoUsers) errors.push("production_must_disable_builtin_demo_users");
    if (!storagePolicy.readyForProductionData) errors.push(storagePolicy.missingReason || "production_storage_not_ready");
    pushUnique(errors, kvServerPolicy.errors);
    pushUnique(errors, fileStoragePolicy.errors);
    pushUnique(errors, auditPolicy.errors);
    pushUnique(errors, aiPolicy.errors);
    warnings.push("server_auth_rls_and_normalized_tables_still_require_backend_implementation");
  }

  return {
    ok: errors.length === 0,
    appMode,
    storageProvider,
    errors,
    warnings,
    kvServer: kvServerPolicy,
    fileStorage: fileStoragePolicy,
    audit: auditPolicy,
    ai: aiPolicy
  };
}
