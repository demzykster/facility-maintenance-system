import { describe, expect, it } from "vitest";
import { buildFleetLicenseImportPreview } from "../src/fleetLicenseImportPreviewModel.js";

const headers = [
  "ספק",
  ":מס' רכב",
  "דגם",
  "ברגולציה",
  "תוקף תסקיר",
  "רישיון",
  "סוג כלי",
  "סיווג כלי",
  ".תאריך סוף עסקה",
  '.חודשי סה"כ'
];

describe("fleet license import preview model", () => {
  it("summarizes new rows, conflicts, invalid rows, and missing catalog additions", () => {
    const preview = buildFleetLicenseImportPreview([
      {
        sheet: "רישיונות",
        data: [
          headers,
          ["טויוטה", "194335", "RRE200H", "כן", "2027-02-09", "2026-08-09", "מלגזת היגש", "כלי שטח תפעולי", "2027-08-17", 2810],
          ["Still", "777", "KNOWN", "לא", "אין תסקיר", "אין רישוי", "עגלת אדם", "כלי", "", "בבעלות"],
          ["Missing", "", "NOCHASSIS", "לא", "אין תסקיר", "אין רישוי", "עגלת אדם", "כלי", "", ""]
        ]
      }
    ], {
      existingFleet: [{ id: "fleet-known", code: "777", chassis: "777" }],
      config: { forkliftTypes: ["KNOWN"], vehicleTypes: [] }
    });

    expect(preview.ok).toBe(true);
    expect(preview.summary).toEqual({ total: 3, ready: 1, conflicts: 1, invalid: 1 });
    expect(preview.newRows).toHaveLength(1);
    expect(preview.conflicts[0]).toMatchObject({ sourceRow: 3, chassis: "777", conflictId: "fleet-known" });
    expect(preview.invalidRows[0]).toMatchObject({ sourceRow: 4, invalid: ["missing_chassis"] });
    expect(preview.catalogAdditions).toEqual([
      {
        name: "מלגזת היגש",
        models: ["RRE200H"],
        docs: { tasrir: true, license: true, lease: true }
      }
    ]);
  });
});
