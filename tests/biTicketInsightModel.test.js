import { describe, expect, it } from "vitest";
import { biFocusDepartmentMatches, recurringFacilityZoneRows } from "../src/biTicketInsightModel.js";

describe("BI ticket insight model", () => {
  it("matches the unassigned department drill-down only to tickets with no department", () => {
    const fleet = [{ id: "fork-a", dept: "A" }];
    const zones = [{ id: "zone-a", name: "Office", dept: "A" }];

    expect(biFocusDepartmentMatches(
      { id: "unassigned", track: "facility", zone: "Unknown" },
      { department: "ללא מחלקה" },
      { fleet, zones }
    )).toBe(true);

    expect(biFocusDepartmentMatches(
      { id: "facility-a", track: "facility", zone: "Office" },
      { department: "ללא מחלקה" },
      { fleet, zones }
    )).toBe(false);

    expect(biFocusDepartmentMatches(
      { id: "transport-a", track: "transport", forkliftId: "fork-a" },
      { department: "A" },
      { fleet, zones }
    )).toBe(true);
  });

  it("shows only genuinely recurring facility zones", () => {
    const rows = recurringFacilityZoneRows([
      { id: "one", zone: "Office", status: "new" },
      { id: "two", zone: "Gallery", status: "new" },
      { id: "three", zone: "Gallery", status: "done" },
      { id: "four", zone: "Warehouse", status: "done" }
    ], {
      isOpenTicket: (ticket) => ticket.status !== "done"
    });

    expect(rows).toEqual([{ key: "Gallery", label: "Gallery", n: 2, open: 1 }]);
  });
});
