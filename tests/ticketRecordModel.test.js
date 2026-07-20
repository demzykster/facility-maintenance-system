import { describe, expect, it } from "vitest";
import { normalizeTicketRecord, ticketRecordFromSupabaseRow, ticketRecordToSupabaseRow } from "../src/ticketRecordModel.js";

describe("ticketRecordModel", () => {
  it("normalizes current UI ticket payloads into a stable production record", () => {
    const record = normalizeTicketRecord({
      id: "T-1",
      num: "42",
      track: "שינוע",
      subject: "Broken forklift",
      status: "open",
      assigneeId: "11111111-1111-1111-1111-111111111111",
      assignee: "Tech",
      reportedBy: { id: "22222222-2222-2222-2222-222222222222", name: "Worker" },
      createdAt: 1_700_000_000_000
    });

    expect(record).toMatchObject({
      id: "T-1",
      num: 42,
      track: "שינוע",
      subject: "Broken forklift",
      status: "open",
      assigneeName: "Tech",
      reportedByName: "Worker",
      sourceKvKey: "ticket:T-1"
    });
    expect(record.createdAt).toBe("2023-11-14T22:13:20.000Z");
  });

  it("maps normalized tickets to the Supabase row contract", () => {
    expect(ticketRecordToSupabaseRow({ id: "T-2", status: "new", subject: "A" })).toMatchObject({
      id: "T-2",
      status: "new",
      subject: "A",
      source_kv_key: "ticket:T-2",
      legacy_payload: { id: "T-2", status: "new", subject: "A" }
    });
  });

  it("maps transport forkliftId into the normalized asset column", () => {
    expect(ticketRecordToSupabaseRow({
      id: "T-210",
      track: "transport",
      subject: "Fork head",
      forkliftId: "fleet-210"
    })).toMatchObject({
      asset_id: "fleet-210"
    });
  });

  it("does not send legacy non-UUID user ids into UUID foreign-key columns", () => {
    expect(ticketRecordToSupabaseRow({
      id: "T-legacy",
      assigneeId: "u-legacy",
      reportedBy: { id: "worker-42", name: "Worker" }
    })).toMatchObject({
      assignee_id: null,
      reported_by_id: null,
      assignee_name: "",
      reported_by_name: "Worker"
    });
  });

  it("hydrates UI-compatible ticket payloads from Supabase rows", () => {
    expect(ticketRecordFromSupabaseRow({
      id: "T-3",
      num: 9,
      track: "facility",
      subject: "Fallback subject",
      status: "open",
      created_at: "2026-07-09T10:00:00.000Z",
      updated_at: "2026-07-09T10:05:00.000Z",
      source_kv_key: "ticket:T-3",
      legacy_payload: {
        id: "T-3",
        subject: "Legacy subject",
        createdAt: 1_700_000_000_000
      }
    })).toMatchObject({
      id: "T-3",
      num: 9,
      subject: "Legacy subject",
      status: "open",
      createdAt: 1_700_000_000_000
    });
  });
});
