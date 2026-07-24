import {
  CANONICAL_EVENT_CATALOG,
  CANONICAL_EVENT_IDS,
  EVENT_CATALOG_AI_RELEVANCE,
  EVENT_CATALOG_KNOWN_GAP_NOTIFICATION_KINDS,
  EVENT_CATALOG_PUSH_POLICIES,
  EVENT_CATALOG_ROUTE_STATUSES,
  EVENT_CATALOG_STATUSES,
  EVENT_CATALOG_SUPPORTED_ROUTES
} from "./eventCatalog.js";

export const REQUIRED_EVENT_CATALOG_FIELDS = Object.freeze([
  "id",
  "domain",
  "operation",
  "producer",
  "authoritativeBoundary",
  "historyIdentifiers",
  "auditIdentifiers",
  "notificationKinds",
  "routes",
  "pushPolicy",
  "aiRelevance",
  "coverage",
  "status",
  "notes"
]);

const DEFAULT_RUNTIME_NOTIFICATION_KINDS = Object.freeze([
  "new",
  "confirm",
  "back",
  "ready",
  "escalate",
  "sla",
  "task",
  "doc",
  "pm",
  "upd",
  "driver",
  "ppe",
  "cleaning",
  "waiting"
]);

const DEFAULT_RUNTIME_PUSH_KINDS = Object.freeze([
  "new",
  "upd",
  "ready",
  "confirm",
  "sla",
  "escalate",
  "task",
  "pm",
  "doc",
  "driver",
  "ppe",
  "cleaning",
  "back",
  "system"
]);

const DEFAULT_DOC_PATHS = Object.freeze([
  "docs/architecture/responsibility-inventory.md",
  "docs/architecture/business-event-inventory.md",
  "docs/architecture/notification-delivery-inventory.md",
  "docs/audits/event-notification-synchronization-gap-matrix.md",
  "docs/architecture/canonical-event-catalog.md"
]);

export function verifyCanonicalEventCatalog({
  catalog = CANONICAL_EVENT_CATALOG,
  files = {},
  runtimeNotificationKinds = DEFAULT_RUNTIME_NOTIFICATION_KINDS,
  runtimePushKinds = DEFAULT_RUNTIME_PUSH_KINDS,
  allowedRuntimeImportPrefixes = ["tests/", "tools/", "docs/"]
} = {}) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const runtimeKinds = new Set(runtimeNotificationKinds);
  const pushKinds = new Set(runtimePushKinds);
  const knownGapKinds = new Set(EVENT_CATALOG_KNOWN_GAP_NOTIFICATION_KINDS);

  for (const entry of catalog) {
    if (!entry || typeof entry !== "object") {
      errors.push("catalog_entry_invalid");
      continue;
    }
    for (const field of REQUIRED_EVENT_CATALOG_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(entry, field)) errors.push(`missing_field:${entry.id || "<unknown>"}:${field}`);
    }
    if (!validEventId(entry.id)) errors.push(`invalid_event_id:${entry.id || "<empty>"}`);
    if (ids.has(entry.id)) errors.push(`duplicate_event_id:${entry.id}`);
    ids.add(entry.id);

    if (!EVENT_CATALOG_STATUSES.includes(entry.status)) errors.push(`invalid_status:${entry.id}:${entry.status}`);
    if (!EVENT_CATALOG_PUSH_POLICIES.includes(entry.pushPolicy)) errors.push(`invalid_push_policy:${entry.id}:${entry.pushPolicy}`);
    if (!EVENT_CATALOG_AI_RELEVANCE.includes(entry.aiRelevance)) errors.push(`invalid_ai_relevance:${entry.id}:${entry.aiRelevance}`);

    for (const kind of entry.notificationKinds || []) {
      if (runtimeKinds.has(kind)) continue;
      if (knownGapKinds.has(kind) && entry.status === "known_gap") continue;
      errors.push(`notification_kind_not_modeled:${entry.id}:${kind}`);
    }

    if (entry.pushPolicy === "eligible") {
      const pushEligibleKinds = (entry.notificationKinds || []).filter((kind) => pushKinds.has(kind));
      if ((entry.notificationKinds || []).length && !pushEligibleKinds.length) {
        errors.push(`push_policy_without_push_kind:${entry.id}`);
      }
    }

    for (const route of entry.routes || []) {
      if (!EVENT_CATALOG_SUPPORTED_ROUTES.includes(route.name)) errors.push(`unsupported_route:${entry.id}:${route.name}`);
      if (!EVENT_CATALOG_ROUTE_STATUSES.includes(route.status)) errors.push(`invalid_route_status:${entry.id}:${route.name}:${route.status}`);
    }

    if (containsSecretLikeValue(entry)) errors.push(`secret_like_value:${entry.id}`);
    if (containsAbsoluteLocalPath(entry)) errors.push(`local_absolute_path:${entry.id}`);
  }

  for (const file of Object.keys(files).sort()) {
    const text = String(files[file] || "");
    if (importsCatalog(text) && !allowedRuntimeImportPrefixes.some((prefix) => normalizePath(file).startsWith(prefix))) {
      errors.push(`runtime_catalog_import:${file}`);
    }
  }

  for (const doc of DEFAULT_DOC_PATHS) {
    if (!Object.prototype.hasOwnProperty.call(files, doc)) continue;
    for (const id of findCanonicalEventIds(files[doc])) {
      if (!ids.has(id)) errors.push(`doc_event_id_missing_catalog_entry:${doc}:${id}`);
    }
  }

  return stableObject({
    ok: errors.length === 0,
    status: errors.length === 0 ? "ready" : "failed",
    catalogEntries: catalog.length,
    catalogIds: [...ids].sort(),
    knownGapNotificationKinds: [...knownGapKinds].sort(),
    errors: [...new Set(errors)].sort(),
    warnings: [...new Set(warnings)].sort(),
    safety: {
      deploys: false,
      mutatesProduction: false,
      networkCalls: false,
      printsSecretValues: false,
      runtimeIntegration: false
    }
  });
}

export function stableEventCatalogJson(value) {
  return JSON.stringify(stableObject(value), null, 2);
}

export function findCanonicalEventIds(text = "") {
  return [...new Set([...String(text || "").matchAll(/\b(?:ticket|work|fleet|ppe|cleaning|identity|ai)\.[a-z0-9_]+(?:_[a-z0-9]+)*\b/g)].map((match) => match[0]))].sort();
}

function validEventId(value = "") {
  return /^(ticket|work|fleet|ppe|cleaning|identity|ai)\.[a-z0-9_]+$/.test(String(value || ""));
}

function importsCatalog(text = "") {
  return /from\s+["'][^"']*eventCatalog\.js["']|import\s*\(\s*["'][^"']*eventCatalog\.js["']\s*\)/.test(String(text || ""));
}

function containsSecretLikeValue(value) {
  return /\b[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|SERVICE_ROLE_KEY|API_KEY)[A-Z0-9_]*\s*=\s*[^<\s`]/.test(JSON.stringify(value || {}));
}

function containsAbsoluteLocalPath(value) {
  return /\/Users\/|\/private\/tmp\//.test(JSON.stringify(value || {}));
}

function normalizePath(file = "") {
  return String(file || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = stableObject(value[key]);
    return acc;
  }, {});
}
