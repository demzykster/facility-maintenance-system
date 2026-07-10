export const DEFAULT_DATA_REFRESH_INTERVAL_MS = 60_000;
export const MIN_DATA_REFRESH_GAP_MS = 30_000;

export function shouldRunDataRefresh({
  now = Date.now(),
  lastStartedAt = 0,
  inFlight = false,
  hidden = false,
  force = false
} = {}) {
  if (inFlight || hidden) return false;
  if (force) return true;
  return Number(now || 0) - Number(lastStartedAt || 0) >= MIN_DATA_REFRESH_GAP_MS;
}
