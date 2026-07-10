import { APP_CONFIG_KEY, parseAppConfigValue } from "./appConfigRecordModel.js";

const cleanString = (value) => String(value || "").trim();

function sortedJson(value) {
  if (Array.isArray(value)) return value.map(sortedJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedJson(value[key])]));
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortedJson(value || {}));
}

export function appConfigMirrorRetirementPlan({ kvRow = null, normalizedRow = null } = {}) {
  const kvKey = cleanString(kvRow?.record_key || kvRow?.key);
  const kvShared = cleanString(kvRow?.scope) === "shared";
  const kvConfig = kvRow ? parseAppConfigValue(kvRow.value) : {};
  const normalizedConfig = normalizedRow?.config || normalizedRow?.legacy_payload || {};
  const matched = Boolean(kvRow && normalizedRow)
    && kvKey === APP_CONFIG_KEY
    && kvShared
    && stableStringify(kvConfig) === stableStringify(normalizedConfig);

  return {
    key: APP_CONFIG_KEY,
    canDelete: matched,
    counts: {
      kv: kvRow ? 1 : 0,
      normalized: normalizedRow ? 1 : 0,
      matched: matched ? 1 : 0
    }
  };
}
