import { describe, expect, it } from "vitest";
import { normalizeWorkerAbsenceRecord, workerAbsenceRecordFromSupabaseRow, workerAbsenceRecordToSupabaseRow } from "../src/workerAbsenceRecordModel.js";

describe("worker absence record model", () => {
  it("normalizes legacy absences for Supabase rows", () => {
    const row = workerAbsenceRecordToSupabaseRow({
      id: "absence-1",
      userId: "not-a-uuid",
      name: "Cleaner",
      from: "2026-07-10",
      to: "2026-07-12",
      reason: "vacation",
      at: 1710000000000
    });

    expect(row).toEqual(expect.objectContaining({
      id: "absence-1",
      user_id: null,
      user_name: "Cleaner",
      starts_on: "2026-07-10",
      ends_on: "2026-07-12",
      reason: "vacation",
      source_kv_key: "cabsence:absence-1",
      legacy_payload: expect.objectContaining({ id: "absence-1", userId: "not-a-uuid" })
    }));
  });

  it("round-trips legacy payloads from Supabase rows", () => {
    const legacy = { id: "absence-1", userId: "worker-1", from: "2026-07-10" };

    expect(workerAbsenceRecordFromSupabaseRow({ id: "absence-1", legacy_payload: legacy })).toBe(legacy);
  });

  it("requires an id", () => {
    expect(() => normalizeWorkerAbsenceRecord({ userId: "worker-1" })).toThrow("worker_absence_id_required");
  });
});
