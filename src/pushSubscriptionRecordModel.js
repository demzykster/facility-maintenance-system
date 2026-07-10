import { notificationPrefsFromUser } from "./notificationAccessModel.js";
import { normalizePushSubscription, pushSubscriptionId } from "./pushNotificationModel.js";

const cleanString = (value) => String(value == null ? "" : value).trim();
const cleanObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const isoOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const timestamp = (value) => {
  const iso = isoOrNull(value);
  return iso ? Date.parse(iso) : undefined;
};

export function normalizePushSubscriptionRecord(record = {}) {
  const subscription = normalizePushSubscription(record.subscription || record);
  if (!subscription) throw new Error("push_subscription_invalid");
  const id = cleanString(record.id || pushSubscriptionId(subscription));
  const userId = cleanString(record.userId || record.user_id);
  if (!id) throw new Error("push_subscription_id_required");
  if (!userId) throw new Error("push_subscription_user_id_required");
  const now = Date.now();
  const createdAt = isoOrNull(record.createdAt || record.created_at) || new Date(now).toISOString();
  const updatedAt = isoOrNull(record.updatedAt || record.updated_at || record.createdAt || record.created_at) || new Date(now).toISOString();
  return {
    id,
    userId,
    userName: cleanString(record.userName || record.user_name),
    userRole: cleanString(record.userRole || record.user_role),
    userPermissions: cleanObject(record.userPermissions || record.user_permissions),
    userCleaningAccess: record.userCleaningAccess && typeof record.userCleaningAccess === "object"
      ? record.userCleaningAccess
      : (record.userCleaningAccess === true ? true : false),
    notificationPrefs: notificationPrefsFromUser(record),
    endpoint: subscription.endpoint,
    subscription,
    createdAt,
    updatedAt,
    legacyPayload: cleanObject(record)
  };
}

export function pushSubscriptionRecordToSupabaseRow(record = {}) {
  const normalized = normalizePushSubscriptionRecord(record);
  return {
    id: normalized.id,
    user_id: normalized.userId,
    user_name: normalized.userName,
    user_role: normalized.userRole,
    user_permissions: normalized.userPermissions,
    user_cleaning_access: normalized.userCleaningAccess,
    notification_prefs: normalized.notificationPrefs,
    endpoint: normalized.endpoint,
    subscription: normalized.subscription,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    legacy_payload: normalized.legacyPayload
  };
}

export function pushSubscriptionRecordFromSupabaseRow(row = {}) {
  const legacy = cleanObject(row.legacy_payload);
  if (legacy.id && normalizePushSubscription(legacy.subscription || legacy)) return legacy;
  const normalized = normalizePushSubscriptionRecord({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    userPermissions: row.user_permissions,
    userCleaningAccess: row.user_cleaning_access,
    notificationPrefs: row.notification_prefs,
    subscription: row.subscription,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at)
  });
  return {
    id: normalized.id,
    userId: normalized.userId,
    userName: normalized.userName,
    userRole: normalized.userRole,
    userPermissions: normalized.userPermissions,
    userCleaningAccess: normalized.userCleaningAccess,
    notificationPrefs: normalized.notificationPrefs,
    createdAt: timestamp(normalized.createdAt),
    updatedAt: timestamp(normalized.updatedAt),
    subscription: normalized.subscription
  };
}
