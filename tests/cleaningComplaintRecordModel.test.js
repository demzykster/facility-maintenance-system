import { describe, expect, it } from "vitest";
import { cleaningComplaintRecordFromSupabaseRow, cleaningComplaintRecordToSupabaseRow, normalizeCleaningComplaintRecord } from "../src/cleaningComplaintRecordModel.js";

describe("cleaning complaint record model", () => {
  it("normalizes legacy complaints for Supabase rows", () => {
    const row = cleaningComplaintRecordToSupabaseRow({
      id: "complaint-1",
      zoneId: "zone-1",
      zoneName: "Lobby",
      kind: "dirty",
      text: "Needs attention",
      at: 1710000000000,
      reportedById: "not-a-uuid",
      reportedByName: "Cleaner",
      photoPath: "cleaning/complaints/complaint-1/photo.jpg",
      verified: true
    });

    expect(row).toEqual(expect.objectContaining({
      id: "complaint-1",
      zone_id: "zone-1",
      zone_name: "Lobby",
      kind: "dirty",
      text: "Needs attention",
      reported_by_id: null,
      reported_by_name: "Cleaner",
      photo_path: "cleaning/complaints/complaint-1/photo.jpg",
      has_photo: true,
      verified: true,
      source_kv_key: "ccomplaint:complaint-1",
      legacy_payload: expect.objectContaining({ id: "complaint-1", zoneId: "zone-1" })
    }));
  });

  it("round-trips legacy payloads from Supabase rows", () => {
    const legacy = { id: "complaint-1", zoneId: "zone-1", at: 1710000000000 };

    expect(cleaningComplaintRecordFromSupabaseRow({ id: "complaint-1", legacy_payload: legacy })).toBe(legacy);
  });

  it("requires an id", () => {
    expect(() => normalizeCleaningComplaintRecord({ zoneId: "zone-1" })).toThrow("cleaning_complaint_id_required");
  });
});
