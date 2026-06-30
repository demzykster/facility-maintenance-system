import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  buildMaintenanceAssignments,
  checklistTemplateMatchesUnit,
  fleetRuleTargetMatchesUnit,
  maintenanceRulesForUnit,
  nextMaintenanceDueFrom,
  normalizeFleetUnitRef,
  normalizeMaintenanceRules
} from "../src/fleetMaintenancePolicyModel.js";

const fleet = [
  { id: "f-1", code: "178039", vehicleTypeName: "מלגזת היגש", modelCode: "8FBE15T" },
  { id: "f-2", code: "6882961", vehicleTypeName: "מלקטת כפולה", modelCode: "OSE250" },
  { id: "f-3", code: "111236", vehicleTypeName: "מלגזת צריח", modelCode: "MX-X" }
];

const localYmd = (timestamp) => {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
};

describe("fleetMaintenancePolicyModel", () => {
  it("allows multiple owner-defined maintenance rules for the same vehicle type", () => {
    const rules = normalizeMaintenanceRules([
      { id: "to-500", name: "TO 500", intervalMonths: 3, vehicleTypeNames: ["מלגזת היגש"] },
      { id: "to-1000", name: "TO 1000", intervalMonths: 12, vehicleTypeNames: ["מלגזת היגש"] },
      { id: "picker-to", name: "Picker check", intervalMonths: 2, vehicleTypeNames: ["מלקטת כפולה"] }
    ]);

    expect(maintenanceRulesForUnit(rules, fleet[0]).map((rule) => rule.name)).toEqual(["TO 500", "TO 1000"]);
    expect(maintenanceRulesForUnit(rules, fleet[1]).map((rule) => rule.name)).toEqual(["Picker check"]);
  });

  it("matches targets by exact unit id, vehicle type, or model code", () => {
    expect(fleetRuleTargetMatchesUnit({ fleetIds: ["f-3"] }, fleet[2])).toBe(true);
    expect(fleetRuleTargetMatchesUnit({ vehicleTypeNames: ["מלגזת היגש"] }, fleet[0])).toBe(true);
    expect(fleetRuleTargetMatchesUnit({ modelCodes: ["OSE250"] }, fleet[1])).toBe(true);
    expect(fleetRuleTargetMatchesUnit({ modelCodes: ["OSE250"] }, fleet[0])).toBe(false);
  });

  it("builds assignments for a fleet without requiring one checklist per vehicle", () => {
    const assignments = buildMaintenanceAssignments([
      { name: "TO 500", intervalMonths: 6, modelCodes: ["8FBE15T", "MX-X"] },
      { name: "TO 1000", intervalMonths: 12, vehicleTypeNames: ["מלגזת היגש"] }
    ], fleet);

    expect(assignments.map(({ unit, rules }) => [unit.id, rules.map((rule) => rule.name)])).toEqual([
      ["f-1", ["TO 500", "TO 1000"]],
      ["f-2", []],
      ["f-3", ["TO 500"]]
    ]);
  });

  it("keeps checklist templates reusable by vehicle type or model", () => {
    const checklist = {
      name: "בדיקת מלגזת היגש",
      items: ["בלמים", "צופר", "נזילות"],
      vehicleTypeNames: ["מלגזת היגש"]
    };

    expect(checklistTemplateMatchesUnit(checklist, fleet[0])).toBe(true);
    expect(checklistTemplateMatchesUnit(checklist, fleet[1])).toBe(false);
  });

  it("can derive a normalized fleet reference from current fleet records and catalog mappings", () => {
    const unit = normalizeFleetUnitRef({ id: "u-1", type: "OSE250", code: "6882961" }, { modelType: { OSE250: "מלקטת כפולה" } });

    expect(unit).toEqual({
      id: "u-1",
      code: "6882961",
      modelCode: "OSE250",
      vehicleTypeName: "מלקטת כפולה"
    });
  });

  it("rejects invalid interval definitions instead of silently creating bad schedules", () => {
    expect(normalizeMaintenanceRules([
      { name: "No interval" },
      { name: "Zero interval", intervalMonths: 0 },
      { name: "Valid", intervalMonths: 1 }
    ]).map((rule) => rule.name)).toEqual(["Valid"]);
  });

  it("calculates future due dates by months, not fixed 30-day buckets", () => {
    const jan31 = new Date(2026, 0, 31).getTime();
    expect(localYmd(addMonthsClamped(jan31, 1))).toBe("2026-02-28");
    expect(localYmd(nextMaintenanceDueFrom(jan31, 12))).toBe("2027-01-31");
  });
});
