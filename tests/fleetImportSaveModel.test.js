import { describe, expect, it } from "vitest";
import { chunkFleetImportUnits, saveFleetImportAtomically } from "../src/fleetImportSaveModel.js";

const units = (count) => Array.from({ length: count }, (_, i) => ({ id: `fleet-${i + 1}`, code: `${i + 1}` }));

describe("fleetImportSaveModel", () => {
  it("chunks fleet import units into safe batches", () => {
    expect(chunkFleetImportUnits(units(6), 2).map((chunk) => chunk.map((unit) => unit.id))).toEqual([
      ["fleet-1", "fleet-2"],
      ["fleet-3", "fleet-4"],
      ["fleet-5", "fleet-6"]
    ]);
  });

  it("saves fleet batches before the catalog", async () => {
    const calls = [];
    const result = await saveFleetImportAtomically({
      units: units(3),
      batchSize: 2,
      saveMany: async (chunk) => { calls.push(["fleet", chunk.map((unit) => unit.id)]); return true; },
      saveCatalog: async () => { calls.push(["catalog"]); return true; }
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      ["fleet", ["fleet-1", "fleet-2"]],
      ["fleet", ["fleet-3"]],
      ["catalog"]
    ]);
  });

  it("saves fleet and catalog additions in one bulk operation", async () => {
    const calls = [];
    const additions = [{ kind: "מדחס", model: "אקדה פנאומטי" }];
    const result = await saveFleetImportAtomically({
      units: units(3),
      catalogAdditions: additions,
      batchSize: 2,
      saveMany: async (chunk, catalogAdditions) => {
        calls.push(["bulk", chunk.map((unit) => unit.id), catalogAdditions]);
        return true;
      },
      saveCatalog: async () => {
        calls.push(["catalog"]);
        return true;
      }
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      ["bulk", ["fleet-1", "fleet-2", "fleet-3"], additions]
    ]);
  });

  it("can save catalog additions without creating fleet units", async () => {
    const calls = [];
    const additions = [{ name: "מלגזת היגש", models: ["RRE200H"] }];
    const result = await saveFleetImportAtomically({
      units: [],
      catalogAdditions: additions,
      saveMany: async () => {
        calls.push(["fleet"]);
        return true;
      },
      saveCatalog: async () => {
        calls.push(["catalog"]);
        return true;
      }
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([["catalog"]]);
  });

  it("reports catalog-only save failure", async () => {
    const result = await saveFleetImportAtomically({
      units: [],
      catalogAdditions: [{ name: "מלגזת היגש", models: ["RRE200H"] }],
      saveCatalog: async () => false
    });

    expect(result).toMatchObject({ ok: false, savedIds: [], rolledBackIds: [], error: "catalog_save_failed" });
  });

  it("rolls back already saved fleet units when a later batch fails", async () => {
    const rolledBack = [];
    const result = await saveFleetImportAtomically({
      units: units(4),
      batchSize: 2,
      saveMany: async (chunk) => chunk[0].id !== "fleet-3",
      rollbackOne: async (id) => { rolledBack.push(id); return true; }
    });

    expect(result.ok).toBe(false);
    expect(rolledBack).toEqual(["fleet-2", "fleet-1"]);
  });

  it("tracks and rolls back single-record saves inside a chunk", async () => {
    const rolledBack = [];
    const result = await saveFleetImportAtomically({
      units: units(3),
      batchSize: 3,
      saveOne: async (unit) => unit.id !== "fleet-2",
      rollbackOne: async (id) => { rolledBack.push(id); return true; }
    });

    expect(result.ok).toBe(false);
    expect(rolledBack).toEqual(["fleet-1"]);
  });

  it("rolls back fleet units if catalog save fails", async () => {
    const rolledBack = [];
    const result = await saveFleetImportAtomically({
      units: units(2),
      saveMany: async () => true,
      saveCatalog: async () => false,
      rollbackOne: async (id) => { rolledBack.push(id); return true; }
    });

    expect(result.ok).toBe(false);
    expect(rolledBack).toEqual(["fleet-2", "fleet-1"]);
  });
});
