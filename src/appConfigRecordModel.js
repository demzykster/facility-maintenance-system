export const APP_CONFIG_KEY = "config:v1";
export const APP_CONFIG_ID = "main";

const cleanObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function parseAppConfigValue(value) {
  if (value == null || value === "") return {};
  if (typeof value === "string") return cleanObject(JSON.parse(value));
  return cleanObject(value);
}

export function normalizeAppConfigRecord(value = {}, { id = APP_CONFIG_ID, sourceKvKey = APP_CONFIG_KEY } = {}) {
  const config = parseAppConfigValue(value);
  return {
    id: String(id || APP_CONFIG_ID).trim() || APP_CONFIG_ID,
    config,
    sourceKvKey: String(sourceKvKey || APP_CONFIG_KEY).trim() || APP_CONFIG_KEY,
    legacyPayload: config
  };
}

export function appConfigRecordToSupabaseRow(value = {}, options = {}) {
  const record = normalizeAppConfigRecord(value, options);
  return {
    id: record.id,
    config: record.config,
    source_kv_key: record.sourceKvKey,
    legacy_payload: record.legacyPayload
  };
}

export function appConfigRecordFromSupabaseRow(row = {}) {
  return normalizeAppConfigRecord(row.config || row.legacy_payload || {}, {
    id: row.id || APP_CONFIG_ID,
    sourceKvKey: row.source_kv_key || APP_CONFIG_KEY
  });
}

export function serializeAppConfigValue(value = {}) {
  return JSON.stringify(parseAppConfigValue(value));
}
