import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  buildMaintenanceAssignments,
  buildMaintenanceScheduleFromRules,
  checklistTemplateMatchesUnit,
  distributeNewTasks,
  fleetRuleTargetMatchesUnit,
  maintenanceIntervalMonthsForTask,
  maintenanceRuleForTask,
  maintenanceRulesForUnit,
  maintenanceTitleForTask,
  nextWorkingDay,
  nextMaintenanceDueFrom,
  normalizeFleetUnitRef,
  normalizeMaintenanceChecklistItems,
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
const localDate = (year, monthIndex, day) => new Date(year, monthIndex, day).getTime();

describe("fleetMaintenancePolicyModel", () => {
  it("allows multiple owner-defined maintenance rules for the same vehicle type", () => {
    const rules = normalizeMaintenanceRules([
      { id: "to-500", name: "TO 500", intervalMonths: 3, vehicleTypeNames: ["מלגזת היגש"], modelCodes: ["MX-X"] },
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

  it("keeps periodic-maintenance checklist items separate from inspection templates", () => {
    const rules = normalizeMaintenanceRules([
      {
        id: "to-500",
        name: "TO 500",
        intervalMonths: 3,
        vehicleTypeNames: ["מלגזת היגש"],
        checklistTemplateId: "inspection-template-should-not-be-used",
        checklistItems: [{ id: "inspection-row", label: "לא לקחת מבקרת כלים" }],
        maintenanceChecklistItems: [
          { id: "oil", label: "בדיקת שמן" },
          { id: "brakes", label: "בדיקת בלמים" },
          { id: "duplicate", label: "בדיקת שמן" }
        ]
      }
    ]);

    expect(rules[0].maintenanceChecklistItems).toEqual([
      { id: "oil", label: "בדיקת שמן" },
      { id: "brakes", label: "בדיקת בלמים" }
    ]);
    expect(rules[0].checklistTemplateId).toBeUndefined();
  });

  it("normalizes periodic-maintenance checklist items without borrowing inspection data", () => {
    expect(normalizeMaintenanceChecklistItems(["שמן", "", { id: "brake", label: "בלמים" }, { label: "שמן" }])).toEqual([
      expect.objectContaining({ label: "שמן" }),
      { id: "brake", label: "בלמים" }
    ]);
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

  it("keeps imported vehicle kind separate from model when normalizing fleet references", () => {
    const unit = normalizeFleetUnitRef({
      id: "u-2",
      code: "6882961",
      vehicleKind: "מלקטת כפולה",
      model: "OSE250",
      type: "מלקטת כפולה"
    });

    expect(unit).toEqual({
      id: "u-2",
      code: "6882961",
      modelCode: "OSE250",
      vehicleTypeName: "מלקטת כפולה"
    });
  });

  it("matches maintenance rules by imported vehicle kind without catalog fallback", () => {
    const importedUnit = normalizeFleetUnitRef({
      id: "u-2",
      code: "6882961",
      vehicleKind: "מלקטת כפולה",
      model: "OSE250",
      type: "מלקטת כפולה"
    });
    const rules = normalizeMaintenanceRules([
      { id: "picker-500", name: "TO 500", intervalMonths: 6, vehicleTypeNames: ["מלקטת כפולה"] }
    ]);

    expect(maintenanceRulesForUnit(rules, importedUnit).map((rule) => rule.id)).toEqual(["picker-500"]);
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

  it("resolves schedule details from a stored maintenance rule while keeping a fallback", () => {
    const rules = normalizeMaintenanceRules([
      { id: "to-500", name: "TO 500", intervalMonths: 4, vehicleTypeNames: ["מלגזת היגש"] }
    ]);
    const task = { maintenanceRuleId: "to-500" };

    expect(maintenanceRuleForTask(task, rules)?.name).toBe("TO 500");
    expect(maintenanceIntervalMonthsForTask(task, rules, 12)).toBe(4);
    expect(maintenanceTitleForTask(task, rules)).toBe("TO 500");
    expect(maintenanceIntervalMonthsForTask({ frequency: "legacy" }, rules, 6)).toBe(6);
  });

  it("builds bulk maintenance schedules by vehicle rule without duplicating existing tasks", () => {
    const rules = normalizeMaintenanceRules([
      { id: "to-500", name: "TO 500", intervalMonths: 3, vehicleTypeNames: ["מלגזת היגש"], modelCodes: ["MX-X"] },
      { id: "to-1000", name: "TO 1000", intervalMonths: 12, vehicleTypeNames: ["מלגזת היגש"] },
      { id: "picker", name: "Picker", intervalMonths: 2, modelCodes: ["OSE250"] }
    ]);
    const existing = [{ id: "old", forkliftId: "f-1", maintenanceRuleId: "to-500", nextDue: 111, history: [{ type: "done" }] }];

    const result = buildMaintenanceScheduleFromRules({
      rules,
      fleetRefs: fleet,
      existingTasks: existing,
      startAt: 222,
      now: 333
    });

    expect(result.created).toBe(3);
    expect(result.updated).toBe(1);
    expect(result.tasks.map((task) => [task.forkliftId, task.maintenanceRuleId, task.nextDue]).sort()).toEqual([
      ["f-1", "to-1000", 222],
      ["f-1", "to-500", 111],
      ["f-2", "picker", 222],
      ["f-3", "to-500", 222]
    ]);
    expect(result.tasks.find((task) => task.id === "old")?.history).toEqual([{ type: "done" }]);
    expect(result.tasks.find((task) => task.maintenanceRuleId === "to-500" && task.forkliftId === "f-3")?.maintenanceChecklistItems).toEqual([]);
  });

  it("carries the dedicated periodic-maintenance checklist into generated schedules", () => {
    const result = buildMaintenanceScheduleFromRules({
      rules: [{
        id: "to-500",
        name: "TO 500",
        intervalMonths: 3,
        vehicleTypeNames: ["מלגזת היגש"],
        maintenanceChecklistItems: [{ id: "oil", label: "בדיקת שמן" }]
      }],
      fleetRefs: fleet,
      existingTasks: [],
      startAt: 222,
      now: 333
    });

    expect(result.tasks.map((task) => task.maintenanceChecklistItems)).toEqual([
      [{ id: "oil", label: "בדיקת שמן" }]
    ]);
  });

  it("distributes six weight-1 maintenance tasks across two capacity-3 days", () => {
    const assignments = Array.from({ length: 6 }, (_, index) => ({ task: { id: `task-${index + 1}` }, weight: 1 }));

    distributeNewTasks(assignments, { startAt: localDate(2026, 0, 4), dailyCapacity: 3 });

    expect(new Set(assignments.map((assignment) => localYmd(assignment.task.nextDue))).size).toBe(2);
  });

  it("keeps weight-2 maintenance tasks on separate days even when capacity is four", () => {
    const assignments = Array.from({ length: 3 }, (_, index) => ({ task: { id: `heavy-${index + 1}` }, weight: 2 }));

    distributeNewTasks(assignments, { startAt: localDate(2026, 0, 4), dailyCapacity: 4 });

    expect(new Set(assignments.map((assignment) => localYmd(assignment.task.nextDue))).size).toBe(3);
  });

  it("schedules weight-2 tasks first and fills remaining capacity with weight-1 tasks", () => {
    const assignments = [
      { task: { id: "light-1" }, weight: 1 },
      { task: { id: "heavy-1" }, weight: 2 },
      { task: { id: "light-2" }, weight: 1 },
      { task: { id: "heavy-2" }, weight: 2 }
    ];

    distributeNewTasks(assignments, { startAt: localDate(2026, 0, 4), dailyCapacity: 3 });

    const byId = Object.fromEntries(assignments.map((assignment) => [assignment.task.id, localYmd(assignment.task.nextDue)]));
    expect(new Set(Object.values(byId))).toEqual(new Set(["2026-01-04", "2026-01-05"]));
    expect(byId["heavy-1"]).toBe("2026-01-04");
    expect(byId["light-1"]).toBe("2026-01-04");
    expect(byId["heavy-2"]).toBe("2026-01-05");
    expect(byId["light-2"]).toBe("2026-01-05");
  });

  it("spreads maintenance tasks across the selected planning window", () => {
    const assignments = Array.from({ length: 4 }, (_, index) => ({ task: { id: `task-${index + 1}` }, weight: 1 }));

    distributeNewTasks(assignments, {
      startAt: localDate(2026, 0, 4),
      endAt: localDate(2026, 0, 7),
      dailyCapacity: 4
    });

    expect(assignments.map((assignment) => localYmd(assignment.task.nextDue))).toEqual([
      "2026-01-04",
      "2026-01-05",
      "2026-01-06",
      "2026-01-07"
    ]);
  });

  it("honors per-type daily maintenance limits while planning", () => {
    const assignments = [
      { task: { id: "reach-1" }, weight: 1, typeName: "מלגזת היגש" },
      { task: { id: "reach-2" }, weight: 1, typeName: "מלגזת היגש" },
      { task: { id: "reach-3" }, weight: 1, typeName: "מלגזת היגש" },
      { task: { id: "picker-1" }, weight: 1, typeName: "מלקטת כפולה" }
    ];

    distributeNewTasks(assignments, {
      startAt: localDate(2026, 0, 4),
      endAt: localDate(2026, 0, 5),
      dailyCapacity: 4,
      perTypeDailyLimits: { "מלגזת היגש": 1 }
    });

    const reachDates = assignments.filter((assignment) => assignment.typeName === "מלגזת היגש").map((assignment) => localYmd(assignment.task.nextDue));
    expect(new Set(reachDates).size).toBe(3);
    expect(localYmd(assignments.find((assignment) => assignment.task.id === "picker-1").task.nextDue)).toBe("2026-01-04");
  });

  it("preserves an existing future nextDue when building schedules from rules", () => {
    const futureDue = localDate(2026, 0, 20);
    const result = buildMaintenanceScheduleFromRules({
      rules: [{ id: "to-500", name: "TO 500", intervalMonths: 3, vehicleTypeNames: ["מלגזת היגש"] }],
      fleetRefs: [fleet[0]],
      existingTasks: [{ id: "existing", forkliftId: "f-1", maintenanceRuleId: "to-500", nextDue: futureDue }],
      startAt: localDate(2026, 0, 4),
      now: localDate(2026, 0, 10)
    });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].nextDue).toBe(futureDue);
  });

  it("redistributes an existing past nextDue when building schedules from rules", () => {
    const result = buildMaintenanceScheduleFromRules({
      rules: [{ id: "to-500", name: "TO 500", intervalMonths: 3, vehicleTypeNames: ["מלגזת היגש"] }],
      fleetRefs: [fleet[0]],
      existingTasks: [{ id: "existing", forkliftId: "f-1", maintenanceRuleId: "to-500", nextDue: localDate(2026, 0, 1) }],
      startAt: localDate(2026, 0, 4),
      now: localDate(2026, 0, 10)
    });

    expect(result.tasks).toHaveLength(1);
    expect(localYmd(result.tasks[0].nextDue)).toBe("2026-01-04");
  });

  it("moves Friday and Saturday starts to Sunday as the next working day", () => {
    expect(localYmd(nextWorkingDay(localDate(2026, 0, 2)))).toBe("2026-01-04");
    expect(localYmd(nextWorkingDay(localDate(2026, 0, 3)))).toBe("2026-01-04");
  });
});
