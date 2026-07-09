import { APP_MODES } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS } from "./storageProviderModel.js";

export function normalizedCleaningRecordsAuthorityEnabled({ appMode, storageProvider, provider } = {}) {
  return appMode === APP_MODES.production
    && storageProvider === STORAGE_PROVIDERS.api
    && !!provider;
}

export async function cleaningComplaintsForAuthority({ kvComplaints = [], provider = null, normalizedAuthority = false } = {}) {
  if (!normalizedAuthority || typeof provider?.list !== "function") {
    return { complaints: kvComplaints, source: "kv" };
  }
  const response = await provider.list();
  const complaints = Array.isArray(response?.complaints) ? response.complaints : [];
  return { complaints, source: "normalized" };
}

export async function workerAbsencesForAuthority({ kvAbsences = [], provider = null, normalizedAuthority = false } = {}) {
  if (!normalizedAuthority || typeof provider?.list !== "function") {
    return { absences: kvAbsences, source: "kv" };
  }
  const response = await provider.list();
  const absences = Array.isArray(response?.absences) ? response.absences : [];
  return { absences, source: "normalized" };
}

export function cleaningComplaintsAuthorityFailureIssue({ action = "", id = "", message = "" } = {}) {
  return {
    kind: `cleaning_complaints_normalized_${action || "operation"}_failed`,
    action,
    key: id ? `ccomplaint:${id}` : "ccomplaint:*",
    message: message || "Normalized cleaning complaints operation failed"
  };
}

export function workerAbsencesAuthorityFailureIssue({ action = "", id = "", message = "" } = {}) {
  return {
    kind: `worker_absences_normalized_${action || "operation"}_failed`,
    action,
    key: id ? `cabsence:${id}` : "cabsence:*",
    message: message || "Normalized worker absences operation failed"
  };
}
