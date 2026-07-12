export const USER_ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function todayPresenceKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function presenceRecordForUser(presence = [], userId, { todayKey = todayPresenceKey() } = {}) {
  const record = (presence || []).find((item) => item?.id === userId);
  if (!record) return { onShift: false };
  const onShift = !!record.onShift && record.day === todayKey;
  return { ...record, onShift };
}

export function isPresenceOnline(record = {}, { now = Date.now(), onlineWindowMs = USER_ONLINE_WINDOW_MS } = {}) {
  const lastSeen = Number(record?.lastSeen || 0);
  return lastSeen > 0 && now - lastSeen <= onlineWindowMs;
}

export function relativePresenceTime(ts, { now = Date.now() } = {}) {
  const lastSeen = Number(ts || 0);
  if (!lastSeen) return "";
  const minutes = Math.max(0, Math.floor((now - lastSeen) / 60000));
  if (minutes < 1) return "כעת";
  if (minutes < 60) return `לפני ${minutes} ד׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "אתמול" : `לפני ${days} ימים`;
  const date = new Date(lastSeen);
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)}`;
}

export function userPresenceStatusText(record = {}, options = {}) {
  if (isPresenceOnline(record, options)) return "פעיל כעת";
  const seen = relativePresenceTime(record?.lastSeen, options);
  return seen ? `נראה לאחרונה ${seen}` : "לא נראה במערכת";
}

export function shiftPresenceStatusText(record = {}, options = {}) {
  const status = userPresenceStatusText(record, options);
  if (record?.onShift) return status === "לא נראה במערכת" ? "במשמרת" : `במשמרת · ${status}`;
  return status === "לא נראה במערכת" ? "לא במשמרת" : `לא במשמרת · ${status}`;
}
