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

const NON_INTERRUPTING_BROWSER_KINDS = new Set(["doc", "pm", "ppe"]);
const NON_INTERRUPTING_BROWSER_KEY_PREFIXES = ["sh-on-", "sh-off-"];

export function browserNotificationEvents(events = []) {
  return events.filter((event) => {
    if (NON_INTERRUPTING_BROWSER_KINDS.has(event?.kind)) return false;
    const key = typeof event?.key === "string" ? event.key : "";
    return !NON_INTERRUPTING_BROWSER_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
  });
}

export function initialBrowserNotificationState(events = []) {
  return {
    maxAt: events.reduce((max, event) => Math.max(max, Number(event?.at) || 0), 0),
    notifiedKeys: [...new Set(events.map((event) => event?.key).filter((key) => typeof key === "string" && key))]
  };
}

export function nextBrowserNotificationEvent(events = [], state = {}) {
  const notifiedKeys = new Set(Array.isArray(state.notifiedKeys) ? state.notifiedKeys : []);
  const sorted = [...events].sort((a, b) => (Number(b?.at) || 0) - (Number(a?.at) || 0));
  const previousMaxAt = parseNotificationSeenAt(state.maxAt);
  const event = sorted.find((item) => {
    const key = typeof item?.key === "string" ? item.key : "";
    if (key && notifiedKeys.has(key)) return false;
    return (Number(item?.at) || 0) > previousMaxAt;
  }) || null;
  const maxAt = sorted.reduce((max, item) => Math.max(max, Number(item?.at) || 0), previousMaxAt);
  if (event?.key) notifiedKeys.add(event.key);
  return { event, maxAt, notifiedKeys: [...notifiedKeys] };
}
