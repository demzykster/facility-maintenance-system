import { APP_MODES } from "./seedPolicyModel.js";
import { STORAGE_PROVIDERS } from "./storageProviderModel.js";

export function normalizedWorkAuthorityEnabled({ appMode, storageProvider, provider } = {}) {
  return appMode === APP_MODES.production
    && storageProvider === STORAGE_PROVIDERS.api
    && !!provider;
}

export async function workForAuthority({
  kvTasks = [],
  kvMeetings = [],
  provider = null,
  normalizedAuthority = false
} = {}) {
  if (!normalizedAuthority || !provider) {
    return { tasks: kvTasks, meetings: kvMeetings, source: "kv" };
  }

  const [tasks, meetings] = await Promise.all([
    provider.tasks?.list?.(),
    provider.meetings?.list?.()
  ]);

  return {
    tasks: Array.isArray(tasks?.tasks) ? tasks.tasks : [],
    meetings: Array.isArray(meetings?.meetings) ? meetings.meetings : [],
    source: "normalized"
  };
}

export function workAuthorityFailureIssue({ action = "", resource = "", id = "", message = "" } = {}) {
  const normalizedResource = resource || "records";
  return {
    kind: `work_normalized_${normalizedResource}_${action || "operation"}_failed`,
    action,
    key: id ? `work:${normalizedResource}:${id}` : `work:${normalizedResource}:*`,
    message: message || "Normalized work-record operation failed"
  };
}
