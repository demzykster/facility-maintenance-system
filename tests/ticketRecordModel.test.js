import { describe, expect, it } from "vitest";
import { normalizeTicketRecord, ticketRecordToSupabaseRow } from "../src/ticketRecordModel.js";

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
});
