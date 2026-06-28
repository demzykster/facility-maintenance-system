export const DEFAULT_LOCAL_NOTIFICATION_PREFS = Object.freeze({
  sort: "newest",
  group: false,
  hidden: {}
});

export function normalizeLocalNotificationPrefs(value, defaults = DEFAULT_LOCAL_NOTIFICATION_PREFS) {
  if (!value || typeof value !== "object") return { ...defaults, hidden: { ...(defaults.hidden || {}) } };
  return {
    ...defaults,
    ...value,
    hidden: value.hidden && typeof value.hidden === "object" ? value.hidden : { ...(defaults.hidden || {}) }
  };
}

export function parseLocalNotificationPrefs(raw, defaults = DEFAULT_LOCAL_NOTIFICATION_PREFS) {
  if (!raw) return normalizeLocalNotificationPrefs(null, defaults);
  try {
    return normalizeLocalNotificationPrefs(JSON.parse(raw), defaults);
  } catch {
    return normalizeLocalNotificationPrefs(null, defaults);
  }
}

export function parseNotificationSeenAt(raw) {
  const ts = Number(raw || 0);
  return Number.isFinite(ts) ? ts : 0;
}
