import { describe, expect, it } from "vitest";
import { applyFleetBulkDepartment, applyFleetBulkDocumentDate, selectedFleetUnits } from "../src/fleetBulkActionsModel.js";

const fleet = [
  { id: "fleet-1", code: "1", dept: "ישן", depts: ["ישן"], docs: { license: { date: "2026-01-01", link: "drive" } } },
  { id: "fleet-2", code: "2", depts: ["אחר"], docs: {} },
  { id: "fleet-3", code: "3" }
];

describe("fleetBulkActionsModel", () => {
  it("selects only fleet rows included in the current selection", () => {
    expect(selectedFleetUnits(fleet, ["fleet-3", "missing", "fleet-1"]).map((unit) => unit.id)).toEqual(["fleet-1", "fleet-3"]);
  });

  it("applies one department to selected fleet units without mutating source rows", () => {
    const updated = applyFleetBulkDepartment([fleet[0], fleet[1]], "מחסן", 123);

    expect(updated).toEqual([
      { ...fleet[0], dept: "מחסן", depts: ["מחסן"], updatedAt: 123 },
      { ...fleet[1], dept: "מחסן", depts: ["מחסן"], updatedAt: 123 }
    ]);
    expect(fleet[0].dept).toBe("ישן");
  });

  it("updates one document date while keeping existing document metadata", () => {
    const updated = applyFleetBulkDocumentDate([fleet[0], fleet[2]], "license", "2027-06-30", 456);

    expect(updated[0].docs.license).toEqual({ date: "2027-06-30", link: "drive" });
    expect(updated[1].docs.license).toEqual({ date: "2027-06-30" });
    expect(updated.map((unit) => unit.updatedAt)).toEqual([456, 456]);
  });

  it("returns no updates when required bulk values are missing", () => {
    expect(applyFleetBulkDepartment(fleet, "")).toEqual([]);
    expect(applyFleetBulkDocumentDate(fleet, "license", "")).toEqual([]);
  });
});
