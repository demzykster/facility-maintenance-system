import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  facilityOwnerPatch,
  isFacilityTicket,
  normalizeFacilitySupplierPatch
} from "../src/facilityTicketRouteModel.js";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const ticketDetailSource = readFileSync(new URL("../src/TicketDetail.jsx", import.meta.url), "utf8");

describe("facility ticket route model", () => {
  it("routes supplier-handled facility tickets into the supplier queue", () => {
    const patch = facilityOwnerPatch(
      { track: "facility", status: "new" },
      { name: "Vadim", role: "admin" },
      { supplier: "מיזוג מרכזי", status: "in_progress" }
    );

    expect(patch).toEqual({
      supplier: "מיזוג מרכזי",
      assignee: "",
      routedTech: true,
      mgrExec: false,
      status: "new"
    });
  });

  it("routes supplier-handled manager facility tickets into the supplier queue", () => {
    expect(facilityOwnerPatch(
      { track: "facility", status: "new" },
      { name: "Manager", role: "user" },
      { supplier: "חשמל" }
    )).toMatchObject({
      supplier: "חשמל",
      assignee: "",
      routedTech: true,
      mgrExec: false,
      status: "new"
    });
  });

  it("keeps unassigned supplier-free facility tickets on the owner route", () => {
    expect(facilityOwnerPatch(
      { track: "facility", status: "new" },
      { name: "Manager", role: "user" },
      { supplier: "" }
    )).toMatchObject({
      supplier: "",
      assignee: "Manager",
      routedTech: false,
      mgrExec: true,
      status: "new"
    });
  });

  it("normalizes only facility supplier patches", () => {
    expect(isFacilityTicket({ track: "facility" })).toBe(true);
    expect(normalizeFacilitySupplierPatch(
      { track: "facility", status: "in_progress" },
      { supplier: "קבלן", routedTech: true },
      { name: "Vadim", role: "admin" }
    )).toMatchObject({
      supplier: "קבלן",
      assignee: "",
      routedTech: true,
      mgrExec: false,
      status: "new"
    });
    expect(normalizeFacilitySupplierPatch(
      { track: "transport", status: "new" },
      { supplier: "קבלן", routedTech: true },
      { name: "Vadim", role: "admin" }
    )).toEqual({ supplier: "קבלן", routedTech: true });
  });

  it("keeps the admin facility panel separate from the executor workflow", () => {
    expect(ticketDetailSource).toContain('isAdmin && track === "transport" && adminTransportExecutionOpen');
    expect(ticketDetailSource).toContain("הצג פעולות ביצוע חריגות");
    expect(ticketDetailSource).toContain("admin-ticket-manual-shell");
    expect(appSource).toContain("ניהול חריג של מנהל מערכת");
  });

  it("keeps facility admin status controls available without technician takeover", () => {
    expect(ticketDetailSource).toContain("סיבות המתנה");
    expect(ticketDetailSource).toContain("סיבת המתנה");
    expect(ticketDetailSource).toContain("facilityAdminDraft.waitingReason");
    expect(ticketDetailSource).not.toContain("סיבת המתנה נוכחית");
    expect(appSource).not.toContain("FACILITY_ADMIN_STATUS_OPTIONS");
    expect(appSource).not.toContain("setFacilityAdminStatus");
    expect(appSource).not.toContain("admin-status-grid");
    expect(appSource).not.toContain("ניהול טיפול שוטף");
  });
});
