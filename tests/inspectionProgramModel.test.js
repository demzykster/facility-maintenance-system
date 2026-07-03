import { describe, expect, it } from "vitest";
import {
  INSPECTION_MONTH_MS,
  buildInspectionDuePairs,
  inspectionProgramsForType,
  isInspectionDue,
  migrateInspectionProgramsFromTemplates,
  nextInspectionDue,
  normalizeInspectionProgram
} from "../src/inspectionProgramModel.js";

describe("normalizeInspectionProgram", () => {
  it("rejects missing name and invalid intervals", () => {
    expect(normalizeInspectionProgram({ intervalMonths: 2 })).toBeNull();
    expect(normalizeInspectionProgram({ name: "Monthly" })).toBeNull();
    expect(normalizeInspectionProgram({ name: "Monthly", intervalMonths: 0 })).toBeNull();
  });

  it("normalizes valid programs and fills defaults", () => {
    expect(normalizeInspectionProgram({ name: "Safety", intervalMonths: 2, checklist: ["בלמים", { label: "צופר" }] })).toEqual({
      id: "iprg-safety-2",
      name: "Safety",
      intervalMonths: 2,
      checklist: [{ id: "ci-0", label: "בלמים" }, { id: "ci-1", label: "צופר" }],
      responsibleIds: [],
      notifyIds: [],
      autoTicket: true,
      active: true
    });
  });
});

describe("inspection due dates", () => {
  const program = { name: "Safety", intervalMonths: 2 };
  const now = Date.UTC(2026, 0, 1);

  it("detects due status by interval", () => {
    expect(isInspectionDue(program, null, now)).toBe(true);
    expect(isInspectionDue(program, now, now)).toBe(false);
    expect(isInspectionDue(program, now - 61 * 86400000, now)).toBe(true);
    expect(isInspectionDue(program, now - 30 * 86400000, now)).toBe(false);
  });

  it("computes next due timestamp", () => {
    expect(nextInspectionDue(program, null)).toBe(0);
    expect(nextInspectionDue(program, now)).toBe(now + 2 * INSPECTION_MONTH_MS);
  });
});

describe("inspectionProgramsForType", () => {
  it("returns only active normalized programs", () => {
    const programs = inspectionProgramsForType({
      inspectionPrograms: [
        { name: "A", intervalMonths: 1 },
        { name: "B", intervalMonths: 2, active: false }
      ]
    });
    expect(programs).toHaveLength(1);
    expect(programs[0].name).toBe("A");
    expect(inspectionProgramsForType({})).toEqual([]);
  });
});

describe("migrateInspectionProgramsFromTemplates", () => {
  it("migrates legacy inspTpl to one inspection program", () => {
    const config = {
      defaultInspIntervalMonths: 2,
      vehicleTypes: [{ id: "vt1", name: "Forklift", inspTpl: "tpl1", models: ["M1"] }]
    };
    const next = migrateInspectionProgramsFromTemplates(config, [{ id: "tpl1", name: "Legacy checklist", items: ["A", "B"] }], 2);
    expect(next.vtInspMigV).toBe(1);
    expect(next.vehicleTypes[0].inspTpl).toBe("tpl1");
    expect(next.vehicleTypes[0].inspectionPrograms).toEqual([{
      id: "iprg-migrated-vt1",
      name: "Legacy checklist",
      intervalMonths: 2,
      checklist: [{ id: "mc-0", label: "A" }, { id: "mc-1", label: "B" }],
      responsibleIds: [],
      notifyIds: [],
      autoTicket: true,
      active: true
    }]);
  });

  it("skips already migrated config and is idempotent", () => {
    const migrated = {
      vtInspMigV: 1,
      vehicleTypes: [{ id: "vt1", inspTpl: "tpl1", inspectionPrograms: [{ name: "Existing", intervalMonths: 1 }] }]
    };
    expect(migrateInspectionProgramsFromTemplates(migrated, [{ id: "tpl1", name: "T", items: [] }], 2)).toBe(migrated);

    const config = { vehicleTypes: [{ id: "vt1", name: "Forklift", inspTpl: "tpl1" }] };
    const once = migrateInspectionProgramsFromTemplates(config, [{ id: "tpl1", name: "T", items: [] }], 2);
    const twice = migrateInspectionProgramsFromTemplates(once, [{ id: "tpl1", name: "T", items: [] }], 2);
    expect(twice).toBe(once);
    expect(twice.vehicleTypes[0].inspectionPrograms).toHaveLength(1);
  });
});

describe("buildInspectionDuePairs", () => {
  const now = Date.UTC(2026, 0, 1);
  const fleet = [{ id: "f1", model: "M1", vehicleTypeName: "Forklift" }];
  const config = {
    vehicleTypes: [{
      id: "vt1",
      name: "Forklift",
      models: ["M1"],
      inspectionPrograms: [{ id: "p1", name: "Program", intervalMonths: 2 }]
    }]
  };

  it("returns program pairs that are due", () => {
    const result = buildInspectionDuePairs({
      fleet,
      config,
      insps: [{ id: "i1", fleetId: "f1", programId: "p1", at: now - 70 * 86400000 }],
      now
    });
    expect(result).toHaveLength(1);
    expect(result[0].prog.id).toBe("p1");
    expect(result[0].legacy).toBe(false);
  });

  it("omits program pairs that are not due", () => {
    const result = buildInspectionDuePairs({
      fleet,
      config,
      insps: [{ id: "i1", fleetId: "f1", programId: "p1", at: now - 10 * 86400000 }],
      now
    });
    expect(result).toEqual([]);
  });

  it("uses legacy path when no vehicle type or no programs match", () => {
    expect(buildInspectionDuePairs({ fleet, config: { vehicleTypes: [] }, insps: [], now })).toEqual([
      { f: fleet[0], prog: null, lastAt: null, legacy: true }
    ]);
    expect(buildInspectionDuePairs({ fleet, config: { vehicleTypes: [{ name: "Forklift", models: ["M1"], inspectionPrograms: [] }] }, insps: [], now })).toEqual([
      { f: fleet[0], prog: null, lastAt: null, legacy: true }
    ]);
  });
});
