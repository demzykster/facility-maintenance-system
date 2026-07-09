import { describe, expect, it } from "vitest";
import { fleetRecordFromSupabaseRow, fleetRecordToSupabaseRow, normalizeFleetRecord } from "../src/fleetRecordModel.js";

describe("fleetRecordModel", () => {
  it("normalizes current fleet records while preserving the full legacy payload", () => {
    const unit = {
      id: "fleet-1",
      code: "178039",
      vehicleType: "מלגזת משקל נגדי",
      model: "8FBE15T",
      supplier: "טויוטה",
      dept: "קבלה",
      zone: "מחסן A",
      createdAt: 1000
    };

    expect(normalizeFleetRecord(unit)).toMatchObject({
      id: "fleet-1",
      code: "178039",
      type: "מלגזת משקל נגדי",
      model: "8FBE15T",
      supplier: "טויוטה",
      department: "קבלה",
      location: "מחסן A",
      status: "active",
      sourceKvKey: "fleet:fleet-1",
      legacyPayload: unit
    });
  });

  it("converts fleet records to Supabase rows", () => {
    expect(fleetRecordToSupabaseRow({
      id: "fleet-1",
      code: "178039",
      type: "מלגזת משקל נגדי",
      model: "8FBE15T",
      status: "blocked",
      updatedAt: 2000
    })).toMatchObject({
      id: "fleet-1",
      code: "178039",
      vehicle_type: "מלגזת משקל נגדי",
      model: "8FBE15T",
      status: "blocked",
      updated_at: "1970-01-01T00:00:02.000Z",
      source_kv_key: "fleet:fleet-1"
    });
  });

  it("returns the legacy payload from Supabase rows for existing UI compatibility", () => {
    const legacy = { id: "fleet-1", code: "178039", type: "8FBE15T", docs: [{ name: "license" }] };

    expect(fleetRecordFromSupabaseRow({
      id: "fleet-1",
      code: "178039",
      vehicle_type: "מלגזה",
      model: "8FBE15T",
      status: "active",
      source_kv_key: "fleet:fleet-1",
      legacy_payload: legacy
    })).toEqual(legacy);
  });

  it("requires a stable fleet id", () => {
    expect(() => normalizeFleetRecord({ code: "178039" })).toThrow("fleet_id_required");
  });
});
