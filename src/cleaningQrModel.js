export const CLEANING_QR_PARAM = "czone";
export const CLEANING_QR_SCAN_PARAM = "z";
export const CLEANING_QR_PREFIX = "czone:";

export function normalizeScannedCleaningZoneId(value) {
  const text = String(value || "").trim();
  return text.startsWith(CLEANING_QR_PREFIX) ? text.slice(CLEANING_QR_PREFIX.length).trim() : text;
}

export function normalizeCleaningQrManualCode(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

export function cleaningQrToken(zoneId) {
  const cleanZoneId = normalizeScannedCleaningZoneId(zoneId);
  return cleanZoneId ? `${CLEANING_QR_PREFIX}${cleanZoneId}` : "";
}

export function appModeRequiresCleaningQr(appMode) {
  return String(appMode || "").trim().toLowerCase() === "production";
}

export function cleaningQrUrl({ origin = "", pathname = "/", zoneId }) {
  const cleanZoneId = normalizeScannedCleaningZoneId(zoneId);
  if (!cleanZoneId) return "";
  try {
    const url = new URL(pathname || "/", origin || "https://cmms.local");
    url.search = "";
    url.hash = "";
    url.searchParams.set(CLEANING_QR_SCAN_PARAM, cleaningQrToken(cleanZoneId));
    return url.toString();
  } catch (e) {
    return `?${CLEANING_QR_SCAN_PARAM}=${encodeURIComponent(cleaningQrToken(cleanZoneId))}`;
  }
}

export function cleaningQrUrlFromWindow(zoneId, win = globalThis.window) {
  const cleanZoneId = normalizeScannedCleaningZoneId(zoneId);
  if (!cleanZoneId) return "";
  if (!win?.location) return `?${CLEANING_QR_SCAN_PARAM}=${encodeURIComponent(cleaningQrToken(cleanZoneId))}`;
  return cleaningQrUrl({
    origin: win.location.origin,
    pathname: win.location.pathname || "/",
    zoneId: cleanZoneId
  });
}

export function scannedCleaningZoneIdFromSearch(search = "") {
  try {
    const params = new URLSearchParams(search || "");
    return normalizeScannedCleaningZoneId(params.get(CLEANING_QR_SCAN_PARAM) || params.get(CLEANING_QR_PARAM));
  } catch (e) {
    return "";
  }
}

export function extractCzoneFromRaw(raw = "") {
  const text = String(raw || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    const fromUrl = normalizeScannedCleaningZoneId(url.searchParams.get(CLEANING_QR_SCAN_PARAM) || url.searchParams.get(CLEANING_QR_PARAM));
    if (fromUrl) return fromUrl;
    if (url.protocol.toLowerCase() === CLEANING_QR_PREFIX) return normalizeScannedCleaningZoneId(url.pathname);
  } catch (e) {
    const query = text.includes("?") ? text.slice(text.indexOf("?")) : text;
    const params = new URLSearchParams(query);
    const fromParams = normalizeScannedCleaningZoneId(params.get(CLEANING_QR_SCAN_PARAM) || params.get(CLEANING_QR_PARAM));
    if (fromParams) return fromParams;
    const match = text.match(/(?:^|[?&#\s])(?:z=)?czone[=:]([^&#\s]+)/i);
    return normalizeScannedCleaningZoneId(match?.[1]);
  }
}

export function scannedCleaningZoneIdFromWindow(win = globalThis.window) {
  return scannedCleaningZoneIdFromSearch(win?.location?.search || "");
}

export function cleaningQrAccess({ appMode, scannedZoneId, zoneId, allowManual = false }) {
  const requiresQr = appModeRequiresCleaningQr(appMode);
  const scanned = normalizeScannedCleaningZoneId(scannedZoneId);
  const zone = normalizeScannedCleaningZoneId(zoneId);
  if (!requiresQr || allowManual) return { allowed: true, reason: "manual_allowed" };
  if (!zone) return { allowed: false, reason: "missing_zone" };
  if (!scanned) return { allowed: false, reason: "scan_required" };
  if (scanned !== zone) return { allowed: false, reason: "wrong_zone" };
  return { allowed: true, reason: "scan_matched" };
}

export function findScannedCleaningZone(zones = [], scannedZoneId = "") {
  const scanned = normalizeScannedCleaningZoneId(scannedZoneId);
  if (!scanned) return null;
  return (zones || []).find((zone) => zone?.id === scanned && zone.active !== false) || null;
}

export function cleaningQrMatchesZone(raw = "", zone = {}) {
  const scanned = normalizeScannedCleaningZoneId(extractCzoneFromRaw(raw) || raw);
  if (!scanned || zone?.active === false) return false;
  if (scanned === zone?.id) return true;
  return normalizeCleaningQrManualCode(scanned) === normalizeCleaningQrManualCode(zone?.code);
}
