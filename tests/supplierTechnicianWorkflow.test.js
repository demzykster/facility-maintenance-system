import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const supplierSource = readFileSync(new URL("../src/SuppliersPanel.jsx", import.meta.url), "utf8");
const ticketVisibilitySource = readFileSync(new URL("../src/ticketVisibilityModel.js", import.meta.url), "utf8");

describe("supplier technician workflow wiring", () => {
  it("keeps technicians connected to supplier cards", () => {
    const detailStart = supplierSource.indexOf("function SupplierDetail(");
    const detailSource = supplierSource.slice(detailStart);
    const panelStart = supplierSource.indexOf("export function SuppliersPanel(");
    const panelEnd = supplierSource.indexOf("function SupplierDetail(", panelStart);
    const panelSource = supplierSource.slice(panelStart, panelEnd);

    expect(detailSource).toContain("users");
    expect(detailSource).toContain('u.role === "tech"');
    expect(detailSource).toContain("u.supplier || \"\"");
    expect(detailSource).toContain('label: "טכנאים"');
    expect(detailSource).toContain("onOpenUser");
    expect(detailSource).toContain("supplier-tech-row");
    expect(source).toContain("<SuppliersPanelLazy");
    expect(source).toContain("ui={{");
    expect(panelSource).toContain("<UserForm user={openUser}");
  });

  it("saves supplier assignment for every technician profile", () => {
    const start = source.indexOf("function UserForm(");
    const end = source.indexOf("const ActivationControls", start);
    const userFormSource = source.slice(start, end);

    expect(userFormSource).toContain('supplier: role === "tech" ? supplier : ""');
  });

  it("keeps transport tickets visible to technicians from the linked fleet supplier", () => {
    expect(ticketVisibilitySource).toContain("session.supplier");
    expect(ticketVisibilitySource).toContain("unit.supplier !== session.supplier");
  });

  it("routes ticket assignment through suppliers instead of direct technician picks", () => {
    const formStart = source.indexOf("function TicketForm(");
    const formEnd = source.indexOf("/* ============================================================ TICKET DETAIL */", formStart);
    const formSource = source.slice(formStart, formEnd);
    const detailStart = source.indexOf("function TicketDetail(");
    const detailEnd = source.indexOf("function CloseModal(", detailStart);
    const detailSource = source.slice(detailStart, detailEnd);

    expect(formSource).toContain("supplierAssign");
    expect(formSource).toContain("supplier: routedSupplier || \"\"");
    expect(formSource).toContain("supplierCandidatesForTicket");
    expect(detailSource).toContain("setSupplierRoute");
    expect(detailSource).toContain("שיוך ספק / קבלן");
    expect(detailSource).not.toContain("p.techNames.map");
    expect(detailSource).not.toContain("שיוך טכנאי");
  });

  it("uses live supplier scopes for facility and PPE categories", () => {
    expect(source).toContain("SUPPLIER_TYPES");
    expect(source).toContain("supplierTypeFromMeta");
    expect(source).toContain("supplierFacilityScope");
    expect(source).toContain("supplierFacilityScopeOptions");
    expect(supplierSource).toContain("supplier-scope-picker");
    expect(source).toContain("supplierHasPpeScope");
    expect(source).toContain("supplierHasFacilityCategory");
    expect(supplierSource).toContain("קטגוריות אחזקת מבנה");
  });
});
