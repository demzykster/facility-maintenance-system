export const BACKUP_APP_ID = "maintenance-cmms";
export const BACKUP_VERSION = 2;

export const BACKUP_COLLECTIONS = Object.freeze([
  { key: "users", prefix: "user:" },
  { key: "fleet", prefix: "fleet:" },
  { key: "tickets", prefix: "ticket:" },
  { key: "pm", prefix: "pm:" },
  { key: "insp", prefix: "insp:" },
  { key: "templates", prefix: "itpl:" },
  { key: "presence", prefix: "presence:" },
  { key: "zones", prefix: "czone:" },
  { key: "rounds", prefix: "cround:" },
  { key: "complaints", prefix: "ccomplaint:" },
  { key: "absences", prefix: "cabsence:" },
  { key: "tasks", prefix: "mtask:" },
  { key: "meetings", prefix: "mmeet:" },
  { key: "ppe", prefix: "ppe:" },
  { key: "ppeItems", prefix: "ppeitem:" },
  { key: "ppeNorms", prefix: "ppenorm:" },
  { key: "ppeReqs", prefix: "ppereq:" },
  { key: "ppeOrders", prefix: "ppeorder:" },
]);

export const BACKUP_COLLECTION_KEYS = BACKUP_COLLECTIONS.map((collection) => collection.key);

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
