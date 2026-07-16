import { describe, expect, it } from "vitest";
import { closedTicketRecord } from "../src/ticketClosureModel.js";

describe("ticket closure model", () => {
  it("sets both top-level closedAt and closure signature timestamps", () => {
    const ticket = {
      id: "F-2",
      track: "facility",
      status: "pending_admin",
      createdAt: 1_000,
      updatedAt: 2_000,
      log: [{ at: 3_000, text: "הטיפול הסתיים — הועבר לסגירת מנהל מערכת" }]
    };

    const next = closedTicketRecord(ticket, {
      costAmount: 120,
      costSupplier: "משב",
      costNote: "הוחלף חלק",
      quality: "resolved"
    }, { name: "Vadim", role: "admin" }, {
      now: 4_000,
      ils: (value) => `₪${value}`
    });

    expect(next).toMatchObject({
      status: "done",
      updatedAt: 4_000,
      closedAt: 3_000,
      downtimeEnd: undefined,
      closure: {
        costAmount: 120,
        costSupplier: "משב",
        costNote: "הוחלף חלק",
        quality: "resolved",
        signedBy: "Vadim",
        signedAt: 3_000,
        recordedAt: 4_000
      }
    });
    expect(next.log.at(-1)).toMatchObject({ text: "נסגרה ואושרה ע״י Vadim · עלות ₪120 · טופל לחלוטין", kind: "close" });
  });

  it("keeps downtimeEnd scoped to transport tickets", () => {
    const next = closedTicketRecord({
      id: "T-2",
      track: "transport",
      log: []
    }, { closedAt: 5_000, quality: "resolved" }, { name: "Vadim", role: "admin" }, { now: 6_000 });

    expect(next.closedAt).toBe(5_000);
    expect(next.downtimeEnd).toBe(5_000);
  });
});
