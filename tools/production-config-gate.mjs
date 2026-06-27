import { appModeFromEnv } from "../src/seedPolicyModel.js";
import { kvServerConfigFromEnv } from "../src/productionServerConfigModel.js";
import { storageApiBaseUrlFromEnv, storageProviderFromEnv } from "../src/storageProviderModel.js";
import { productionConfigGate } from "../src/productionConfigGateModel.js";

const appMode = appModeFromEnv(process.env);
const storageProvider = storageProviderFromEnv(process.env);
const storageApiBaseUrl = storageApiBaseUrlFromEnv(process.env);
const kvServer = kvServerConfigFromEnv(process.env);
const result = productionConfigGate({ appMode, storageProvider, storageApiBaseUrl, kvServer });

for (const warning of result.warnings) console.warn(`[production-config] warning: ${warning}`);

if (!result.ok) {
  console.error(`[production-config] failed for mode=${result.appMode}, storage=${result.storageProvider}`);
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`[production-config] ok for mode=${result.appMode}, storage=${result.storageProvider}`);
