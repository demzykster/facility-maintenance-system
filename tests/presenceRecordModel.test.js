import { describe, expect, it } from "vitest";
import { normalizePresenceRecord, presenceRecordFromSupabaseRow, presenceRecordToSupabaseRow } from "../src/presenceRecordModel.js";

describe("presence record model", () => {
  it("normalizes legacy presence records for Supabase rows", () => {
    const row = presenceRecordToSupabaseRow({
      id: "user-1",
      name: "Tech",
      onShift: true,
      since: 1783658000000,
      lastSeen: 1783658300000,
      day: "2026-07-10"
    });

    expect(row).toMatchObject({
      id: "user-1",
      display_name: "Tech",
      on_shift: true,
      source_kv_key: "presence:user-1",
      legacy_payload: expect.objectContaining({ id: "user-1", name: "Tech" })
    });
    expect(row.since_at).toBe("2026-07-10T04:33:20.000Z");
    expect(row.last_seen_at).toBe("2026-07-10T04:38:20.000Z");
  });

  it("restores the legacy payload when a Supabase row has one", () => {
    expect(presenceRecordFromSupabaseRow({
      id: "user-1",
      display_name: "Fallback",
      legacy_payload: { id: "user-1", name: "Legacy", lastSeen: 123 }
    })).toEqual({ id: "user-1", name: "Legacy", lastSeen: 123 });
  });

  it("requires a presence id", () => {
    expect(() => normalizePresenceRecord({ name: "Missing" })).toThrow("presence_id_required");
  });
});
