import { describe, expect, it } from "vitest";
import {
  cleaningZoneRecordFromSupabaseRow,
  cleaningZoneRecordToSupabaseRow,
  normalizeCleaningZoneRecord
} from "../src/cleaningZoneRecordModel.js";

describe("cleaning zone record model", () => {
  it("normalizes cleaning zones for the first table-backed API seam", () => {
    expect(normalizeCleaningZoneRecord({
      id: "zone-1",
      name: "Lobby",
      building: "A",
      floor: "1",
      areaName: "Main",
      cleanerId: "app-user-1",
      cleanerName: "Cleaner",
      checklist: [{ id: "floor" }],
      windows: [{ id: "morning", time: "08:00" }],
      active: true,
      createdAt: 1000
    })).toEqual(expect.objectContaining({
      id: "zone-1",
      name: "Lobby",
      building: "A",
      floor: "1",
      areaName: "Main",
      cleanerId: "app-user-1",
      cleanerName: "Cleaner",
      checklist: [{ id: "floor" }],
      windows: [{ id: "morning", time: "08:00" }],
      active: true,
      createdAt: "1970-01-01T00:00:01.000Z",
      sourceKvKey: "czone:zone-1"
    }));
  });

  it("maps cleaning zones to Supabase rows while preserving legacy payload", () => {
    expect(cleaningZoneRecordToSupabaseRow({
      id: "zone-1",
      name: "Lobby",
      building: "A",
      floor: "1",
      areaName: "Main",
      active: false,
      checklist: [{ id: "floor" }]
    })).toEqual(expect.objectContaining({
      id: "zone-1",
      name: "Lobby",
      building: "A",
      floor: "1",
      area_name: "Main",
      cleaner_id: null,
      cleaner_name: "",
      active: false,
      checklist: [{ id: "floor" }],
      windows: [],
      source_kv_key: "czone:zone-1",
      legacy_payload: expect.objectContaining({ id: "zone-1", name: "Lobby" })
    }));
  });

  it("restores the legacy payload when reading Supabase rows", () => {
    expect(cleaningZoneRecordFromSupabaseRow({
      id: "zone-1",
      name: "Lobby",
      area_name: "Main",
      active: true,
      source_kv_key: "czone:zone-1",
      legacy_payload: { id: "zone-1", name: "Legacy Lobby", customField: "kept" }
    })).toEqual({ id: "zone-1", name: "Legacy Lobby", customField: "kept" });
  });
});
