const RETIRED_PRODUCTION_API_WRITE_PREFIXES = Object.freeze([
  "presence:",
  "pushSubscriptions:v1",
  "config:v1",
  "user:",
  "ticket:",
  "photo:",
  "fleet:",
  "pm:",
  "mtask:",
  "mmeet:",
  "location:",
  "czone:",
  "cround:",
  "ccomplaint:",
  "cabsence:",
  "ppe:",
  "ppeitem:",
  "ppenorm:",
  "ppereq:",
  "ppeorder:",
  "appIssue:"
]);

export function retiredKvWritePrefixes({ appMode = "", storageProvider = "" } = {}) {
  const productionApi = String(appMode || "").trim().toLowerCase() === "production"
    && String(storageProvider || "").trim().toLowerCase() === "api";
  return productionApi ? RETIRED_PRODUCTION_API_WRITE_PREFIXES : [];
}

export function retiredKvWriteKey(key = "", options = {}) {
  const recordKey = String(key || "");
  return retiredKvWritePrefixes(options).find((prefix) => recordKey.startsWith(prefix)) || "";
}

export function activeKvWriteRecords(records = [], options = {}) {
  const active = [];
  const retired = [];
  for (const record of records || []) {
    const prefix = retiredKvWriteKey(record?.key, options);
    if (prefix) retired.push({ ...record, retiredPrefix: prefix });
    else active.push(record);
  }
  return { active, retired };
}
