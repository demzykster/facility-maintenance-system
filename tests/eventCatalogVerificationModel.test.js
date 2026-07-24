import { describe, expect, it } from "vitest";
import {
  CANONICAL_EVENT_CATALOG,
  CANONICAL_EVENT_IDS
} from "../tools/contracts/eventCatalog.js";
import {
  REQUIRED_EVENT_CATALOG_FIELDS,
  findCanonicalEventIds,
  stableEventCatalogJson,
  verifyCanonicalEventCatalog
} from "../tools/contracts/eventCatalogVerificationModel.js";

const docs = {
  "docs/architecture/responsibility-inventory.md": "See `ticket.create` and `ticket.no_equipment_waiting`.",
  "docs/architecture/business-event-inventory.md": "See `cleaning.complaint_created`.",
  "docs/architecture/notification-delivery-inventory.md": "See `fleet.document_warning`.",
  "docs/audits/event-notification-synchronization-gap-matrix.md": "See `ai.confirmed_ticket_create`.",
  "docs/architecture/canonical-event-catalog.md": "See `identity.first_install_completed`."
};

describe("canonical event catalog verification", () => {
  it("has unique canonical event ids", () => {
    expect(new Set(CANONICAL_EVENT_IDS).size).toBe(CANONICAL_EVENT_IDS.length);
  });

  it("requires every metadata field on every catalog entry", () => {
    for (const entry of CANONICAL_EVENT_CATALOG) {
      for (const field of REQUIRED_EVENT_CATALOG_FIELDS) {
        expect(entry).toHaveProperty(field);
      }
    }
  });

  it("accepts the current catalog with waiting registered as panel-only", () => {
    const result = verifyCanonicalEventCatalog({ files: docs });

    expect(result.ok).toBe(true);
    expect(result.knownGapNotificationKinds).toEqual([]);
    expect(result.catalogIds).toContain("ticket.no_equipment_waiting");
  });

  it("does not silently accept a notification kind outside runtime catalogs", () => {
    const catalog = CANONICAL_EVENT_CATALOG.map((entry) => entry.id === "ticket.no_equipment_waiting"
      ? { ...entry, notificationKinds: ["waiting_missing"] }
      : entry);

    const result = verifyCanonicalEventCatalog({ catalog, files: docs });

    expect(result.errors).toContain("notification_kind_not_modeled:ticket.no_equipment_waiting:waiting_missing");
  });

  it("rejects unsupported routes unless the catalog classifies them", () => {
    const catalog = CANONICAL_EVENT_CATALOG.map((entry) => entry.id === "ticket.create"
      ? { ...entry, routes: [{ name: "secret_panel", status: "supported" }] }
      : entry);

    const result = verifyCanonicalEventCatalog({ catalog, files: docs });

    expect(result.errors).toContain("unsupported_route:ticket.create:secret_panel");
  });

  it("rejects production runtime imports of the static catalog", () => {
    const result = verifyCanonicalEventCatalog({
      files: {
        ...docs,
        "src/ClaudeMaintenanceApp.jsx": "import { CANONICAL_EVENT_CATALOG } from '../tools/contracts/eventCatalog.js';"
      }
    });

    expect(result.errors).toContain("runtime_catalog_import:src/ClaudeMaintenanceApp.jsx");
  });

  it("allows tooling and tests to import the static catalog", () => {
    const result = verifyCanonicalEventCatalog({
      files: {
        ...docs,
        "tools/event-catalog-verify.mjs": "import { CANONICAL_EVENT_CATALOG } from './contracts/eventCatalog.js';",
        "tests/eventCatalogVerificationModel.test.js": "import { CANONICAL_EVENT_CATALOG } from '../tools/contracts/eventCatalog.js';"
      }
    });

    expect(result.errors).not.toContain("runtime_catalog_import:tools/event-catalog-verify.mjs");
    expect(result.errors).not.toContain("runtime_catalog_import:tests/eventCatalogVerificationModel.test.js");
  });

  it("requires canonical event ids mentioned in docs to exist in the catalog", () => {
    const result = verifyCanonicalEventCatalog({
      files: {
        ...docs,
        "docs/architecture/business-event-inventory.md": "Unknown id `ticket.missing_event`."
      }
    });

    expect(result.errors).toContain("doc_event_id_missing_catalog_entry:docs/architecture/business-event-inventory.md:ticket.missing_event");
  });

  it("finds canonical ids in markdown text", () => {
    expect(findCanonicalEventIds("Use `ticket.create`, `ai.assist`, and plain words.")).toEqual(["ai.assist", "ticket.create"]);
  });

  it("returns stable JSON and no side effects", () => {
    const first = stableEventCatalogJson(verifyCanonicalEventCatalog({ files: docs }));
    const second = stableEventCatalogJson(verifyCanonicalEventCatalog({ files: docs }));

    expect(first).toBe(second);
    expect(JSON.parse(first).safety).toEqual({
      deploys: false,
      mutatesProduction: false,
      networkCalls: false,
      printsSecretValues: false,
      runtimeIntegration: false
    });
  });
});
