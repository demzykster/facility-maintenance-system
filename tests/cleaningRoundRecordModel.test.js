import { describe, expect, it } from "vitest";
import {
  cleaningRoundRecordFromSupabaseRow,
  cleaningRoundRecordToSupabaseRow,
  normalizeCleaningRoundRecord
} from "../src/cleaningRoundRecordModel.js";

describe("cleaning round record model", () => {
  it("normalizes cleaning rounds for the table-backed API seam", () => {
    expect(normalizeCleaningRoundRecord({
      id: "round-1",
      zoneId: "zone-1",
      byUid: "9f6a8a64-5c34-4cb6-b3a9-7f8f5846a444",
      byName: "Cleaner",
      status: "done",
      at: 1000,
      issues: [{ id: "soap" }],
      items: { floor: true }
    })).toEqual(expect.objectContaining({
      id: "round-1",
      zoneId: "zone-1",
      cleanerId: "9f6a8a64-5c34-4cb6-b3a9-7f8f5846a444",
      cleanerName: "Cleaner",
      status: "done",
      roundAt: "1970-01-01T00:00:01.000Z",
      completedAt: "1970-01-01T00:00:01.000Z",
      issues: [{ id: "soap" }],
      checklist: { floor: true },
      sourceKvKey: "cround:round-1"
    }));
  });

  it("keeps legacy cleaner IDs in the payload without writing them to the UUID column", () => {
    expect(cleaningRoundRecordToSupabaseRow({
      id: "round-1",
      zoneId: "zone-1",
      byUid: "legacy-cleaner-1",
      byName: "Cleaner"
    })).toEqual(expect.objectContaining({
      zone_id: "zone-1",
      cleaner_id: null,
      cleaner_name: "Cleaner",
      legacy_payload: expect.objectContaining({ byUid: "legacy-cleaner-1" })
    }));
  });

  it("restores the legacy payload when reading Supabase rows", () => {
    expect(cleaningRoundRecordFromSupabaseRow({
      id: "round-1",
      zone_id: "zone-1",
      cleaner_name: "Cleaner",
      source_kv_key: "cround:round-1",
      legacy_payload: { id: "round-1", zoneId: "zone-legacy", customField: "kept" }
    })).toEqual({ id: "round-1", zoneId: "zone-legacy", customField: "kept" });
  });
});
