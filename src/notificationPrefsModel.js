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

export function parseNotificationReadState(raw) {
  if (!raw) return { seenAt: 0, seenKeys: [] };
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === "object") {
      return {
        seenAt: parseNotificationSeenAt(value.seenAt),
        seenKeys: Array.isArray(value.seenKeys) ? value.seenKeys.filter((key) => typeof key === "string") : []
      };
    }
  } catch {}
  return { seenAt: parseNotificationSeenAt(raw), seenKeys: [] };
}

export function notificationReadStateForEvents(events = [], now = Date.now()) {
  const seenAt = Math.max(
    Number(now) || 0,
    events.reduce((max, event) => Math.max(max, Number(event?.at) || 0), 0)
  );
  const seenKeys = [...new Set(events.map((event) => event?.key).filter((key) => typeof key === "string" && key))];
  return { seenAt, seenKeys };
}

export function unreadNotificationKeySet(events = [], readState = {}) {
  const seenAt = parseNotificationSeenAt(readState.seenAt);
  const seenKeys = new Set(Array.isArray(readState.seenKeys) ? readState.seenKeys : []);
  return new Set(
    events
      .filter((event) => {
        const key = typeof event?.key === "string" ? event.key : "";
        if (key && seenKeys.has(key)) return false;
        return (Number(event?.at) || 0) > seenAt;
      })
      .map((event) => event.key)
      .filter(Boolean)
  );
}
