import { APP_MODES } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS } from "./storageProviderModel.js";

export function normalizedTicketAuthorityEnabled({ appMode, storageProvider, provider } = {}) {
  return appMode === APP_MODES.production
    && storageProvider === STORAGE_PROVIDERS.api
    && !!provider;
}

export async function ticketsForAuthority({ kvTickets = [], provider = null, normalizedAuthority = false } = {}) {
  if (!normalizedAuthority || typeof provider?.list !== "function") {
    return { tickets: kvTickets, source: "kv" };
  }
  const response = await provider.list();
  const tickets = Array.isArray(response?.tickets) ? response.tickets : [];
  return { tickets, source: "normalized" };
}

export function ticketAuthorityFailureIssue({ action = "", id = "", message = "" } = {}) {
  return {
    kind: `ticket_normalized_${action || "operation"}_failed`,
    action,
    key: id ? `ticket:${id}` : "ticket:*",
    message: message || "Normalized ticket operation failed"
  };
}
