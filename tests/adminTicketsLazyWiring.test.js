import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const adminTicketsSource = readFileSync(new URL("../src/AdminTickets.jsx", import.meta.url), "utf8");

describe("admin ticket list lazy wiring", () => {
  it("keeps the admin ticket list behind a lazy wrapper", () => {
    expect(appSource).toContain('const AdminTicketsLazy = lazy(() => import("./AdminTickets.jsx")');
    expect(appSource).toContain("<AdminTicketsLazy");
    expect(appSource).toContain("adminTicketsUi");
    expect(appSource).not.toContain("function AdminTickets({ tickets");
  });

  it("keeps ticket filtering and export behavior in the lazy screen module", () => {
    expect(adminTicketsSource).toContain("export function AdminTickets(");
    expect(adminTicketsSource).toContain("ticketLifecycleSummary");
    expect(adminTicketsSource).toContain("ייצוא ל-Excel");
  });
});
