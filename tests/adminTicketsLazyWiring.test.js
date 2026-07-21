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
    expect(adminTicketsSource).toContain("semanticTicketListGroups");
    expect(adminTicketsSource).toContain("users,");
    expect(adminTicketsSource).not.toContain("ballIn(t)");
    expect(appSource).toContain("ticketListCardSemantics");
    expect(appSource).toContain("semantics.executionRows.map");
    expect(appSource).toContain("semantics.sla");
    expect(adminTicketsSource).toContain("ייצוא ל-Excel");
  });

  it("preserves the pre-semantic-rollout ticket list typography contract", () => {
    expect(appSource).toContain('.sect{font-family:var(--font-body);font-weight:600;font-size:14px;');
    expect(appSource).toContain('.tcard-subj{font-weight:650;font-size:14.5px;');
    expect(appSource).toContain('.tcard-sub{display:flex;align-items:center;gap:4px;flex-wrap:nowrap;color:var(--muted);font-size:12.5px;');
    expect(appSource).toContain('.tcard-semantics{display:grid;gap:2px;margin:3px 0 1px;font-family:var(--font-body);font-size:12px;font-weight:700;line-height:normal;letter-spacing:0;}');
    expect(appSource).toContain('.tcard-badges .badge,.tcard-badges .risk-badge{border:1px solid rgba(201,205,209,.72);}');
  });
});
