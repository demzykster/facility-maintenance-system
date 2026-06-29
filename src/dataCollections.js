export const DATA_COLLECTIONS = Object.freeze([
  { key: "users", prefix: "user:", table: "app_users" },
  { key: "fleet", prefix: "fleet:", table: "fleet_units" },
  { key: "tickets", prefix: "ticket:", table: "tickets" },
  { key: "pm", prefix: "pm:", table: "periodic_maintenance" },
  { key: "insp", prefix: "insp:", table: "fleet_inspections" },
  { key: "templates", prefix: "itpl:", table: "inspection_templates" },
  { key: "presence", prefix: "presence:", table: "technician_presence" },
  { key: "zones", prefix: "czone:", table: "cleaning_zones" },
  { key: "rounds", prefix: "cround:", table: "cleaning_rounds" },
  { key: "complaints", prefix: "ccomplaint:", table: "cleaning_complaints" },
  { key: "absences", prefix: "cabsence:", table: "worker_absences" },
  { key: "tasks", prefix: "mtask:", table: "maintenance_tasks" },
  { key: "meetings", prefix: "mmeet:", table: "maintenance_meetings" },
  { key: "ppe", prefix: "ppe:", table: "ppe_movements" },
  { key: "ppeItems", prefix: "ppeitem:", table: "ppe_items" },
  { key: "ppeNorms", prefix: "ppenorm:", table: "ppe_norms" },
  { key: "ppeReqs", prefix: "ppereq:", table: "ppe_requests" },
  { key: "ppeOrders", prefix: "ppeorder:", table: "ppe_orders" },
  { key: "appIssues", prefix: "appIssue:", table: "app_issue_reports" },
]);

export const DATA_COLLECTION_KEYS = DATA_COLLECTIONS.map((collection) => collection.key);
export const DATA_COLLECTION_PREFIXES = DATA_COLLECTIONS.map((collection) => collection.prefix);
export const DATA_COLLECTION_TABLES = DATA_COLLECTIONS.map((collection) => collection.table);
