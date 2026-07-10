import { describe, expect, it } from "vitest";
import {
  maintenanceMeetingRecordFromSupabaseRow,
  maintenanceMeetingRecordToSupabaseRow,
  maintenanceTaskRecordFromSupabaseRow,
  maintenanceTaskRecordToSupabaseRow,
  normalizeMaintenanceMeetingRecord,
  normalizeMaintenanceTaskRecord
} from "../src/workRecordModel.js";

describe("work record model", () => {
  it("normalizes maintenance tasks with source KV keys", () => {
    const normalized = normalizeMaintenanceTaskRecord({
      id: "task-1",
      title: "Inspect",
      status: "open",
      source: "meeting",
      meetingId: "meet-1",
      responsibleIds: ["u1"],
      createdAt: 1780000000000
    });

    expect(normalized).toMatchObject({
      id: "task-1",
      title: "Inspect",
      status: "open",
      sourceModule: "meeting",
      meetingId: "meet-1",
      responsibleIds: ["u1"],
      sourceKvKey: "mtask:task-1"
    });
    expect(normalized.createdAt).toBe(new Date(1780000000000).toISOString());
  });

  it("maps maintenance tasks to Supabase rows and preserves legacy payloads", () => {
    const row = maintenanceTaskRecordToSupabaseRow({ id: "task-1", title: "Inspect", responsibleIds: ["u1"] });

    expect(row).toMatchObject({
      id: "task-1",
      title: "Inspect",
      responsible_ids: ["u1"],
      source_kv_key: "mtask:task-1"
    });
    expect(maintenanceTaskRecordFromSupabaseRow({ ...row, legacy_payload: { id: "task-1", title: "Legacy" } })).toEqual({
      id: "task-1",
      title: "Legacy"
    });
  });

  it("maps maintenance meetings to Supabase rows and fallback payloads", () => {
    const row = maintenanceMeetingRecordToSupabaseRow({
      id: "meet-1",
      title: "Weekly",
      status: "planned",
      participantIds: ["u1"],
      at: 1780000000000
    });

    expect(row).toMatchObject({
      id: "meet-1",
      title: "Weekly",
      participant_ids: ["u1"],
      meeting_at: new Date(1780000000000).toISOString(),
      source_kv_key: "mmeet:meet-1"
    });
    expect(maintenanceMeetingRecordFromSupabaseRow({ ...row, legacy_payload: {} })).toMatchObject({
      id: "meet-1",
      title: "Weekly",
      status: "planned",
      participantIds: ["u1"]
    });
  });

  it("requires ids for work records", () => {
    expect(() => normalizeMaintenanceTaskRecord({})).toThrow("maintenance_task_id_required");
    expect(() => normalizeMaintenanceMeetingRecord({})).toThrow("maintenance_meeting_id_required");
  });
});
