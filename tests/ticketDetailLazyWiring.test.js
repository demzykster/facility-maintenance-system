import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const ticketDetailSource = readFileSync(new URL("../src/TicketDetail.jsx", import.meta.url), "utf8");

describe("ticket detail lazy wiring", () => {
  it("keeps ticket details behind a lazy wrapper", () => {
    expect(appSource).toContain('const TicketDetailLazy = lazy(() => import("./TicketDetail.jsx")');
    expect(appSource).toContain("<TicketDetailLazy");
    expect(appSource).toContain("ticketDetailUi");
    expect(appSource).not.toContain("export function TicketDetail(");
    expect(appSource).not.toContain("function AdminTicketManualPanel(");
  });

  it("keeps close, supplier routing, and admin edit workflows in the lazy module", () => {
    expect(ticketDetailSource).toContain("export function TicketDetail(");
    expect(ticketDetailSource).toContain("function AdminTicketManualPanel(");
    expect(ticketDetailSource).toContain("function AdminTicketQuickEdit(");
    expect(ticketDetailSource).toContain("function CloseModal(");
    expect(ticketDetailSource).toContain("setSupplierRoute");
    expect(ticketDetailSource).toContain("שיוך ספק / קבלן");
  });

  it("does not pass stale runtime helpers into the lazy ticket detail bridge", () => {
    expect(ticketDetailSource).not.toContain('uiFn("msFromInput")');
    expect(appSource).not.toContain("msFromInput,");
  });
});
