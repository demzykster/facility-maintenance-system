export function storedRateLimitTimestamp(value) {
  const raw = value && typeof value === "object" && "value" in value ? value.value : value;
  const ts = Number(raw || 0);
  return Number.isFinite(ts) ? ts : 0;
}

export function isRateLimited(lastValue, now = Date.now(), windowMs = 45000) {
  const last = storedRateLimitTimestamp(lastValue);
  return last > 0 && now - last < windowMs;
}
