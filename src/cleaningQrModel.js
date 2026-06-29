export const CLEANING_QR_PARAM = "czone";

export function normalizeScannedCleaningZoneId(value) {
  return String(value || "").trim();
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
    url.searchParams.set(CLEANING_QR_PARAM, cleanZoneId);
    return url.toString();
  } catch (e) {
    return `?${CLEANING_QR_PARAM}=${encodeURIComponent(cleanZoneId)}`;
  }
}

export function cleaningQrUrlFromWindow(zoneId, win = globalThis.window) {
  const cleanZoneId = normalizeScannedCleaningZoneId(zoneId);
  if (!cleanZoneId) return "";
  if (!win?.location) return `?${CLEANING_QR_PARAM}=${encodeURIComponent(cleanZoneId)}`;
  return cleaningQrUrl({
    origin: win.location.origin,
    pathname: win.location.pathname || "/",
    zoneId: cleanZoneId
  });
}

export function scannedCleaningZoneIdFromSearch(search = "") {
  try {
    return normalizeScannedCleaningZoneId(new URLSearchParams(search || "").get(CLEANING_QR_PARAM));
  } catch (e) {
    return "";
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
