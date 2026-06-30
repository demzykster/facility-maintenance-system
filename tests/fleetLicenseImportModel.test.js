import { describe, expect, it } from "vitest";
import { detectFleetLicenseColumns, parseFleetLicenseSheet, parseFleetLicenseWorkbook, planFleetLicenseCatalogAdditions } from "../src/fleetLicenseImportModel.js";

const headers = [
  "ספק",
  ":מס' רכב",
  "דגם",
  "ברגולציה",
  "תוקף תסקיר",
  "ימי לבדיקה תסקיר",
  "טווח בדיקה תסקיר",
  "סטאטוס",
  "רישיון",
  "ימי לבדיקה רישוי",
  "טווח בדיקה רישיון",
  "סטאטוס",
  "סוג כלי",
  "סיווג כלי",
  ".תאריך תחילת עסקה",
  ".תאריך סוף עסקה",
  '.חודשי סה"כ',
  "=TODAY()"
];

describe("fleet license import model", () => {
  it("detects the Hebrew fleet license sheet columns and ignored formula counters", () => {
    const detected = detectFleetLicenseColumns(headers);

    expect(detected.map).toMatchObject({
      supplier: 0,
      chassis: 1,
      model: 2,
      regulated: 3,
      tasrirDate: 4,
      licenseDate: 8,
      vehicleKind: 12,
      classification: 13,
      leaseStart: 14,
      leaseEnd: 15,
      leaseCost: 16
    });
    expect(detected.ignored).toEqual(expect.arrayContaining(["ימי לבדיקה תסקיר", "סטאטוס", "=TODAY()"]));
  });

  it("maps rows into fleet import drafts with separate vehicle type and model fields", () => {
    const result = parseFleetLicenseSheet([
      headers,
      [
        "טויוטה",
        "194335",
        "RRE200H",
        "כן",
        new Date("2027-02-09T00:00:00Z"),
        238,
        "כל 14 חודשים",
        "תקין",
        new Date("2026-08-09T00:00:00Z"),
        54,
        "כל 12 חודשים",
        "תקין",
        "מלגזת היגש",
        "כלי שטח תפעולי",
        new Date("2021-08-17T00:00:00Z"),
        new Date("2027-08-17T00:00:00Z"),
        2810,
        "בוצע טסט"
      ]
    ]);

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ total: 1, ready: 1, conflicts: 0, invalid: 0 });
    expect(result.rows[0]).toMatchObject({
      action: "new",
      warnings: expect.arrayContaining(["code_uses_chassis_until_manual_code_review"]),
      unit: {
        code: "194335",
        chassis: "194335",
        supplier: "טויוטה",
        type: "מלגזת היגש",
        model: "RRE200H",
        license: "",
        leaseCost: 2810,
        notes: "",
        vehicleKind: "מלגזת היגש",
        classification: "כלי שטח תפעולי",
        regulated: true,
        leaseStart: "2021-08-17",
        leaseEnd: "2027-08-17",
        leaseOwnership: "leased",
        docs: {
          tasrir: { date: "2027-02-09", link: "" },
          license: { date: "2026-08-09", link: "" },
          lease: { date: "2027-08-17", link: "" }
        }
      }
    });
  });

  it("marks existing matching chassis as a conflict instead of silently updating", () => {
    const result = parseFleetLicenseSheet([
      headers,
      ["טויוטה", "194335", "RRE200H", "כן", "אין תסקיר", "", "", "", "אין רישוי", "", "", "", "מלגזת היגש", "כלי שטח תפעולי", "", "", "בבעלות", ""]
    ], { existingFleet: [{ id: "fleet-1", code: "194335", chassis: "194335" }] });

    expect(result.summary).toMatchObject({ total: 1, ready: 0, conflicts: 1, invalid: 0 });
    expect(result.rows[0]).toMatchObject({
      action: "conflict",
      conflictId: "fleet-1",
      unit: {
        leaseCost: 0,
        leaseOwnership: "owned",
        docs: {}
      }
    });
  });

  it("marks duplicate chassis inside the workbook as invalid before import", () => {
    const result = parseFleetLicenseSheet([
      headers,
      ["פסלטון", "פסולתון", "פסולתון", "לא", "2027-02-09", "", "", "", "אין רישוי", "", "", "", "פסלטון", "כלי", "", "", "בבעלות", ""],
      ["פסלטון", "פסולתון", "פסולתון", "לא", "2027-02-10", "", "", "", "אין רישוי", "", "", "", "פסלטון", "כלי", "", "", "בבעלות", ""]
    ]);

    expect(result.summary).toMatchObject({ total: 2, ready: 0, conflicts: 0, invalid: 2 });
    expect(result.rows.map((row) => row.invalid)).toEqual([
      ["duplicate_chassis_in_file"],
      ["duplicate_chassis_in_file"]
    ]);
  });

  it("rejects files that do not contain the required fleet license header", () => {
    expect(parseFleetLicenseSheet([["title", "status"], ["task", "done"]])).toMatchObject({
      ok: false,
      error: "fleet_license_header_not_found"
    });
  });

  it("imports only the רישיונות workbook sheet", () => {
    expect(parseFleetLicenseWorkbook([{ sheet: "DB", data: [headers] }])).toMatchObject({
      ok: false,
      error: "fleet_license_sheet_not_found"
    });

    expect(parseFleetLicenseWorkbook([
      { sheet: "DB", data: [["title"]] },
      { sheet: "רישיונות", data: [headers, ["טויוטה", "194335", "RRE200H", "כן", "אין תסקיר", "", "", "", "אין רישוי", "", "", "", "מלגזת היגש", "כלי שטח תפעולי", "", "", "בבעלות", ""]] }
    ])).toMatchObject({
      ok: true,
      summary: { total: 1, ready: 1, conflicts: 0, invalid: 0 }
    });
  });

  it("plans missing vehicle catalog entries for new imported models", () => {
    const parsed = parseFleetLicenseSheet([
      headers,
      ["טויוטה", "194335", "RRE200H", "כן", "2027-02-09", "", "", "", "2026-08-09", "", "", "", "מלגזת היגש", "כלי שטח תפעולי", "", "2027-08-17", 2810, ""],
      ["טויוטה", "194336", "RRE200H", "כן", "2027-02-10", "", "", "", "2026-08-10", "", "", "", "מלגזת היגש", "כלי שטח תפעולי", "", "2027-08-18", 2810, ""],
      ["Still", "771", "KNOWN", "לא", "אין תסקיר", "", "", "", "אין רישוי", "", "", "", "עגלת אדם", "כלי", "", "", "בבעלות", ""]
    ], { existingFleet: [] });

    expect(planFleetLicenseCatalogAdditions(parsed.rows, { forkliftTypes: ["KNOWN"], vehicleTypes: [] })).toEqual([
      {
        name: "מלגזת היגש",
        models: ["RRE200H"],
        docs: { tasrir: true, license: true, lease: true }
      }
    ]);
  });

  it("keeps vehicle type and model as separate catalog dimensions", () => {
    const parsed = parseFleetLicenseSheet([
      headers,
      ["טויוטה", "178039", "8FBE15T", "כן", "2027-02-09", "", "", "", "2026-08-09", "", "", "", "מלגזת משקל נגדי", "כלי שטח תפעולי", "", "2027-08-17", 2810, ""],
      ["טויוטה", "213580", "8FBE15T", "כן", "2027-02-10", "", "", "", "2026-08-10", "", "", "", "מלגזת משקל נגדי (דיזל)", "כלי שטח תפעולי", "", "2027-08-18", 2810, ""]
    ]);

    expect(planFleetLicenseCatalogAdditions(parsed.rows, { vehicleTypes: [] })).toEqual([
      {
        name: "מלגזת משקל נגדי",
        models: ["8FBE15T"],
        docs: { tasrir: true, license: true, lease: true }
      },
      {
        name: "מלגזת משקל נגדי (דיזל)",
        models: ["8FBE15T"],
        docs: { tasrir: true, license: true, lease: true }
      }
    ]);
  });

  it("plans catalog repair from conflict rows when fleet already exists", () => {
    const parsed = parseFleetLicenseSheet([
      headers,
      ["טויוטה", "194335", "RRE200H", "כן", "2027-02-09", "", "", "", "2026-08-09", "", "", "", "מלגזת היגש", "כלי שטח תפעולי", "", "2027-08-17", 2810, ""],
      ["טויוטה", "6882002", "OSE250", "כן", "2027-02-10", "", "", "", "2026-08-10", "", "", "", "מלקטת (כפולה)", "כלי שטח תפעולי", "", "", "בבעלות", ""]
    ], {
      existingFleet: [
        { id: "fleet-1", code: "194335", chassis: "194335" },
        { id: "fleet-2", code: "6882002", chassis: "6882002" }
      ]
    });

    expect(parsed.summary).toMatchObject({ ready: 0, conflicts: 2, invalid: 0 });
    expect(planFleetLicenseCatalogAdditions(parsed.rows, {
      vehicleTypes: [{ name: "מלקטת (כפולה)", models: ["OSE250"], tasrir: true, license: true, lease: false }]
    }, { includeActions: ["new", "conflict"] })).toEqual([
      {
        name: "מלגזת היגש",
        models: ["RRE200H"],
        docs: { tasrir: true, license: true, lease: true }
      }
    ]);
  });
});
