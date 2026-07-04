import { DATA_COLLECTIONS, DATA_COLLECTION_KEYS } from "./dataCollections.js";

export const BACKUP_APP_ID = "maintenance-cmms";
export const BACKUP_VERSION = 4;

export const BACKUP_COLLECTIONS = DATA_COLLECTIONS;

export const BACKUP_COLLECTION_KEYS = DATA_COLLECTION_KEYS;

export function analyzeBackupPayload(data) {
  if (!data || data.__app !== BACKUP_APP_ID) return { valid: false, missingCollections: [], legacy: false };
  const missingCollections = BACKUP_COLLECTION_KEYS.filter((key) => !Array.isArray(data[key]));
  const version = Number(data.v || 1);
  return {
    valid: true,
    version,
    legacy: version < BACKUP_VERSION || missingCollections.length > 0,
    missingCollections,
  };
}

export function buildBackupPayload({ config, collections, photos = {}, exportedAt = Date.now() }) {
  const payload = {
    __app: BACKUP_APP_ID,
    v: BACKUP_VERSION,
    exportedAt,
    config,
  };

  for (const { key } of BACKUP_COLLECTIONS) {
    payload[key] = Array.isArray(collections?.[key]) ? collections[key] : [];
  }

  payload.photos = photos && typeof photos === "object" ? photos : {};
  return payload;
}

export function shouldExportLegacyTicketPhoto(ticket, kind = "before") {
  if (!ticket || typeof ticket !== "object") return false;
  if (kind === "after") return Boolean(ticket.hasAfterPhoto && !ticket.afterPhotoPath);
  return Boolean(ticket.hasPhoto && !ticket.photoPath);
}
