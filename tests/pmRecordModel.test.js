import { describe, expect, it } from "vitest";
import { normalizePmRecord, pmRecordFromSupabaseRow, pmRecordToSupabaseRow } from "../src/pmRecordModel.js";

describe("pmRecordModel", () => {
  it("normalizes periodic maintenance tasks into durable Supabase fields", () => {
    const task = {
      id: "pm-1",
      forkliftId: "fleet-1",
      title: "TO 500",
      frequency: "monthly",
      active: true,
      nextDue: Date.UTC(2026, 0, 5),
      history: [{ type: "done" }]
    };

    expect(normalizePmRecord(task)).toMatchObject({
      id: "pm-1",
      fleetUnitId: "fleet-1",
      title: "TO 500",
      frequency: "monthly",
      active: true,
      nextDue: "2026-01-05T00:00:00.000Z",
      sourceKvKey: "pm:pm-1",
      legacyPayload: task
    });
  });

  it("converts to a Supabase row while preserving the legacy payload", () => {
    const row = pmRecordToSupabaseRow({ id: "pm-2", fleetUnitId: "fleet-2", title: "TO 1000", active: false });

    expect(row).toMatchObject({
      id: "pm-2",
      fleet_unit_id: "fleet-2",
      title: "TO 1000",
      active: false,
      source_kv_key: "pm:pm-2",
      legacy_payload: { id: "pm-2", fleetUnitId: "fleet-2", title: "TO 1000", active: false }
    });
  });

  it("returns the legacy payload from Supabase rows so existing UI contracts stay stable", () => {
    const legacy = { id: "pm-3", forkliftId: "fleet-3", title: "TO 2000", nextDue: 123 };

    expect(pmRecordFromSupabaseRow({ id: "pm-3", legacy_payload: legacy })).toEqual(legacy);
  });

  it("requires an id", () => {
    expect(() => normalizePmRecord({ title: "TO" })).toThrow("pm_id_required");
  });
});
