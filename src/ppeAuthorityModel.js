import { APP_MODES } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS } from "./storageProviderModel.js";

export function normalizedPpeAuthorityEnabled({ appMode, storageProvider, provider } = {}) {
  return appMode === APP_MODES.production
    && storageProvider === STORAGE_PROVIDERS.api
    && !!provider;
}

export async function ppeForAuthority({
  kvMovements = [],
  kvItems = [],
  kvNorms = [],
  kvRequests = [],
  kvOrders = [],
  provider = null,
  normalizedAuthority = false
} = {}) {
  if (!normalizedAuthority || !provider) {
    return {
      movements: kvMovements,
      items: kvItems,
      norms: kvNorms,
      requests: kvRequests,
      orders: kvOrders,
      source: "kv"
    };
  }

  const [movements, items, norms, requests, orders] = await Promise.all([
    provider.movements?.list?.(),
    provider.items?.list?.(),
    provider.norms?.list?.(),
    provider.requests?.list?.(),
    provider.orders?.list?.()
  ]);

  return {
    movements: Array.isArray(movements?.movements) ? movements.movements : [],
    items: Array.isArray(items?.items) ? items.items : [],
    norms: Array.isArray(norms?.norms) ? norms.norms : [],
    requests: Array.isArray(requests?.requests) ? requests.requests : [],
    orders: Array.isArray(orders?.orders) ? orders.orders : [],
    source: "normalized"
  };
}

export function ppeAuthorityFailureIssue({ action = "", resource = "", id = "", message = "" } = {}) {
  const normalizedResource = resource || "records";
  return {
    kind: `ppe_normalized_${normalizedResource}_${action || "operation"}_failed`,
    action,
    key: id ? `ppe:${normalizedResource}:${id}` : `ppe:${normalizedResource}:*`,
    message: message || "Normalized PPE operation failed"
  };
}
