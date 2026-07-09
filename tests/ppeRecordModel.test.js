import { describe, expect, it } from "vitest";
import {
  normalizePpeItemRecord,
  normalizePpeMovementRecord,
  normalizePpeNormRecord,
  normalizePpeOrderRecord,
  normalizePpeRequestRecord,
  ppeItemRecordFromSupabaseRow,
  ppeItemRecordToSupabaseRow,
  ppeRequestRecordFromSupabaseRow,
  ppeRequestRecordToSupabaseRow
} from "../src/ppeRecordModel.js";

describe("PPE record model", () => {
  it("normalizes PPE movement records with source KV keys", () => {
    const normalized = normalizePpeMovementRecord({
      id: "move-1",
      workerId: "worker-1",
      itemId: "vest",
      qty: "2",
      type: "issue",
      at: 1780000000000
    });

    expect(normalized).toMatchObject({
      id: "move-1",
      workerId: "worker-1",
      itemId: "vest",
      qty: 2,
      movementType: "issue",
      sourceKvKey: "ppe:move-1"
    });
    expect(normalized.movementAt).toBe(new Date(1780000000000).toISOString());
  });

  it("maps PPE item records to Supabase rows and preserves legacy payloads", () => {
    const row = ppeItemRecordToSupabaseRow({
      id: "item-1",
      name: "Vest",
      category: "hivis",
      sizes: ["M", "L"],
      stockBySize: { M: 3 },
      minBySize: { M: 1 },
      active: false
    });

    expect(row).toMatchObject({
      id: "item-1",
      name: "Vest",
      category: "hivis",
      active: false,
      sizes: ["M", "L"],
      stock_by_size: { M: 3 },
      min_by_size: { M: 1 },
      source_kv_key: "ppeitem:item-1"
    });
    expect(ppeItemRecordFromSupabaseRow({ ...row, legacy_payload: { id: "item-1", name: "Legacy Vest" } })).toEqual({
      id: "item-1",
      name: "Legacy Vest"
    });
  });

  it("maps PPE request rows back to UI-compatible payloads", () => {
    const row = ppeRequestRecordToSupabaseRow({
      id: "req-1",
      workerId: "40799a86-b7c8-47b8-94d1-ecd36949ae00",
      workerName: "Worker",
      status: "pending",
      lines: [{ itemId: "item-1", qty: 1 }],
      at: 1780000000000
    });

    expect(row.worker_id).toBe("40799a86-b7c8-47b8-94d1-ecd36949ae00");
    expect(row.requested_at).toBe(new Date(1780000000000).toISOString());
    expect(ppeRequestRecordFromSupabaseRow({ ...row, legacy_payload: {} })).toMatchObject({
      id: "req-1",
      workerId: "40799a86-b7c8-47b8-94d1-ecd36949ae00",
      workerName: "Worker",
      status: "pending",
      lines: [{ itemId: "item-1", qty: 1 }]
    });
  });

  it("requires ids for all PPE resources", () => {
    expect(() => normalizePpeItemRecord({})).toThrow("ppe_item_id_required");
    expect(() => normalizePpeNormRecord({})).toThrow("ppe_norm_id_required");
    expect(() => normalizePpeMovementRecord({})).toThrow("ppe_movement_id_required");
    expect(() => normalizePpeRequestRecord({})).toThrow("ppe_request_id_required");
    expect(() => normalizePpeOrderRecord({})).toThrow("ppe_order_id_required");
  });
});
