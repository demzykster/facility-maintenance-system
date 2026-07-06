export const CLEANING_QR_PARAM = "czone";
export const CLEANING_QR_SCAN_PARAM = "z";
export const CLEANING_QR_PREFIX = "czone:";
export const CLEANING_QR_SUBZONE_SEPARATOR = "~";

export function normalizeScannedCleaningZoneId(value) {
  const text = String(value || "").trim();
  return text.startsWith(CLEANING_QR_PREFIX) ? text.slice(CLEANING_QR_PREFIX.length).trim() : text;
}

export function cleaningQrTarget(zoneId, subzoneId = "") {
  const zone = normalizeScannedCleaningZoneId(zoneId);
  const subzone = String(subzoneId || "").trim();
  return zone && subzone ? `${zone}${CLEANING_QR_SUBZONE_SEPARATOR}${subzone}` : zone;
}

export function parseCleaningQrTarget(value = "") {
  const scanned = normalizeScannedCleaningZoneId(value);
  const [zoneId = "", subzoneId = ""] = scanned.split(CLEANING_QR_SUBZONE_SEPARATOR);
  return { zoneId: zoneId.trim(), subzoneId: subzoneId.trim() };
}

export function normalizeCleaningQrManualCode(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

export function cleaningQrToken(zoneId, subzoneId = "") {
  const target = cleaningQrTarget(zoneId, subzoneId);
  return target ? `${CLEANING_QR_PREFIX}${target}` : "";
}

export function appModeRequiresCleaningQr(appMode) {
  return String(appMode || "").trim().toLowerCase() === "production";
}

export function cleaningQrUrl({ origin = "", pathname = "/", zoneId, subzoneId = "" }) {
  const target = cleaningQrTarget(zoneId, subzoneId);
  if (!target) return "";
  try {
    const url = new URL(pathname || "/", origin || "https://cmms.local");
    url.search = "";
    url.hash = "";
    url.searchParams.set(CLEANING_QR_SCAN_PARAM, cleaningQrToken(target));
    return url.toString();
  } catch (e) {
    return `?${CLEANING_QR_SCAN_PARAM}=${encodeURIComponent(cleaningQrToken(target))}`;
  }
}

export function cleaningQrUrlFromWindow(zoneId, win = globalThis.window, subzoneId = "") {
  const target = cleaningQrTarget(zoneId, subzoneId);
  if (!target) return "";
  if (!win?.location) return `?${CLEANING_QR_SCAN_PARAM}=${encodeURIComponent(cleaningQrToken(target))}`;
  return cleaningQrUrl({
    origin: win.location.origin,
    pathname: win.location.pathname || "/",
    zoneId,
    subzoneId
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
  const scanned = parseCleaningQrTarget(scannedZoneId).zoneId;
  const zone = normalizeScannedCleaningZoneId(zoneId);
  if (!requiresQr || allowManual) return { allowed: true, reason: "manual_allowed" };
  if (!zone) return { allowed: false, reason: "missing_zone" };
  if (!scanned) return { allowed: false, reason: "scan_required" };
  if (scanned !== zone) return { allowed: false, reason: "wrong_zone" };
  return { allowed: true, reason: "scan_matched" };
}

export function findScannedCleaningZone(zones = [], scannedZoneId = "") {
  const scanned = parseCleaningQrTarget(scannedZoneId).zoneId;
  if (!scanned) return null;
  return (zones || []).find((zone) => zone?.id === scanned && zone.active !== false) || null;
}

export function normalizeCleaningSubzones(subzones = []) {
  return (subzones || [])
    .map((subzone) => ({
      id: String(subzone?.id || "").trim(),
      name: String(subzone?.name || "").replace(/\s+/g, " ").trim(),
      code: normalizeCleaningQrManualCode(subzone?.code || ""),
      active: subzone?.active !== false,
      checklist: Array.isArray(subzone?.checklist) ? subzone.checklist : []
    }))
    .filter((subzone) => subzone.id && subzone.name);
}

export function findCleaningQrTarget(zones = [], scannedZoneId = "") {
  const target = parseCleaningQrTarget(scannedZoneId);
  if (!target.zoneId) return null;
  const zone = (zones || []).find((item) => item?.id === target.zoneId && item.active !== false);
  if (!zone) return null;
  if (!target.subzoneId) return { zone, subzone: null };
  const subzone = normalizeCleaningSubzones(zone.subzones).find((item) => item.id === target.subzoneId && item.active !== false);
  return subzone ? { zone, subzone } : null;
}

export function cleaningQrMatchesZone(raw = "", zone = {}) {
  const scanned = normalizeScannedCleaningZoneId(extractCzoneFromRaw(raw) || raw);
  if (!scanned || zone?.active === false) return false;
  const target = parseCleaningQrTarget(scanned);
  if (target.zoneId === zone?.id) {
    if (!target.subzoneId) return true;
    return normalizeCleaningSubzones(zone.subzones).some((subzone) => subzone.id === target.subzoneId && subzone.active !== false);
  }
  const manual = normalizeCleaningQrManualCode(scanned);
  if (manual === normalizeCleaningQrManualCode(zone?.code)) return true;
  return normalizeCleaningSubzones(zone.subzones).some((subzone) => subzone.code && subzone.code === manual && subzone.active !== false);
}

export function cleaningQrMatchesTarget(raw = "", zone = {}, subzone = null) {
  if (!subzone) return cleaningQrMatchesZone(raw, zone);
  const scanned = normalizeScannedCleaningZoneId(extractCzoneFromRaw(raw) || raw);
  if (!scanned || zone?.active === false || subzone?.active === false) return false;
  const target = parseCleaningQrTarget(scanned);
  if (target.zoneId === zone?.id && target.subzoneId === subzone?.id) return true;
  return normalizeCleaningQrManualCode(scanned) === normalizeCleaningQrManualCode(subzone?.code);
}
