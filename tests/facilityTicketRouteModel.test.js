import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  facilityOwnerPatch,
  isFacilityTicket,
  normalizeFacilitySupplierPatch
} from "../src/facilityTicketRouteModel.js";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("facility ticket route model", () => {
  it("keeps supplier-handled facility tickets on the admin route", () => {
    const patch = facilityOwnerPatch(
      { track: "facility", status: "new" },
      { name: "Vadim", role: "admin" },
      { supplier: "מיזוג מרכזי", status: "in_progress" }
    );

    expect(patch).toEqual({
      supplier: "מיזוג מרכזי",
      assignee: "Vadim",
      routedTech: false,
      mgrExec: false,
      status: "new"
    });
  });

  it("keeps department-manager facility tickets on the manager route", () => {
    expect(facilityOwnerPatch(
      { track: "facility", status: "new" },
      { name: "Manager", role: "user" },
      { supplier: "חשמל" }
    )).toMatchObject({
      supplier: "חשמל",
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
      assignee: "Vadim",
      routedTech: false,
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
    expect(appSource).toContain('isAdmin && track !== "facility"');
    expect(appSource).toContain("admin-ticket-manual-shell");
    expect(appSource).toContain("ניהול חריג של מנהל מערכת");
  });

  it("keeps facility admin status controls available without technician takeover", () => {
    expect(appSource).toContain("FACILITY_ADMIN_STATUS_OPTIONS");
    expect(appSource).toContain("setFacilityAdminStatus");
    expect(appSource).toContain('ticket.supplier ? "supplier" : "other"');
    expect(appSource).toContain("סיבת המתנה");
    expect(appSource).not.toContain("admin-status-grid");
    expect(appSource).not.toContain("ניהול טיפול שוטף");
  });
});
