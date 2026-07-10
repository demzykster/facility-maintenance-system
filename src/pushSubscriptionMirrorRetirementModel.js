import { parsePushSubscriptions, PUSH_SUBSCRIPTIONS_KEY } from "./pushNotificationModel.js";

const cleanString = (value) => String(value || "").trim();

export function pushSubscriptionMirrorRetirementPlan({ kvRow = null, normalizedRows = [] } = {}) {
  const normalizedIds = new Set((normalizedRows || [])
    .map((row) => cleanString(row.id))
    .filter(Boolean));
  const kvSubscriptions = kvRow ? parsePushSubscriptions(kvRow.value) : [];
  const missingNormalizedIds = kvSubscriptions
    .map((record) => record.id)
    .filter((id) => !normalizedIds.has(id))
    .sort();
  const kvKey = cleanString(kvRow?.record_key || kvRow?.key);
  const kvShared = cleanString(kvRow?.scope) === "shared";
  const canDelete = Boolean(kvRow) && kvKey === PUSH_SUBSCRIPTIONS_KEY && kvShared && missingNormalizedIds.length === 0;

  return {
    key: PUSH_SUBSCRIPTIONS_KEY,
    canDelete,
    counts: {
      kv: kvRow ? 1 : 0,
      kvSubscriptions: kvSubscriptions.length,
      normalized: normalizedIds.size,
      missingNormalized: missingNormalizedIds.length
    },
    missingNormalizedIds
  };
}
