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

  it("keeps close, supplier context, and admin edit workflows in the lazy module", () => {
    expect(ticketDetailSource).toContain("export function TicketDetail(");
    expect(ticketDetailSource).toContain("function AdminTicketManualPanel(");
    expect(ticketDetailSource).toContain("function AdminTicketQuickEdit(");
    expect(ticketDetailSource).toContain("function CloseModal(");
    expect(ticketDetailSource).toContain("transportTicketSupplierName");
    expect(ticketDetailSource).toContain("שיוך ספק / קבלן");
    expect(ticketDetailSource).toContain("ספק כלי");
  });

  it("does not pass stale runtime helpers into the lazy ticket detail bridge", () => {
    expect(ticketDetailSource).not.toContain('uiFn("msFromInput")');
    expect(appSource).not.toContain("msFromInput,");
    expect(ticketDetailSource).not.toContain('uiFn("normalizeTicketHistory")');
    expect(appSource).not.toContain("normalizeTicketHistory,");
  });

  it("passes ticket detail admin-edit dependencies through the lazy bridge", () => {
    for (const required of ["STATUSES", "dtLevels", "datetimeValueToMs", "applyAdminTicketManualEdit"]) {
      expect(ticketDetailSource).toContain(required);
      expect(appSource).toContain(`${required},`);
    }
  });
});
