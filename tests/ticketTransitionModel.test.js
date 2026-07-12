import { describe, expect, it } from "vitest";
import { applyTicketStatusTiming } from "../src/ticketTransitionModel.js";

describe("ticket status timing", () => {
  it("uses the factual transition time when a waiting transport unit is received later", () => {
    const previous = {
      id: "ticket-1",
      status: "waiting",
      waitingReason: "no_equipment",
      statusSince: 1_000,
      statusMs: { new: 500 }
    };

    const next = applyTicketStatusTiming({
      ...previous,
      status: "in_progress",
      waitingReason: null,
      statusTransitionAt: 4_000
    }, previous, 10_000);

    expect(next.statusMs).toEqual({ new: 500, "waiting:no_equipment": 3_000 });
    expect(next.statusSince).toBe(4_000);
    expect(next.statusTransitionAt).toBeUndefined();
  });

  it("keeps existing timing when the status did not change", () => {
    const previous = {
      id: "ticket-1",
      status: "in_progress",
      statusSince: 2_000,
      statusMs: { new: 1_000 }
    };

    const next = applyTicketStatusTiming({ ...previous, subject: "updated" }, previous, 10_000);

    expect(next.statusMs).toEqual({ new: 1_000 });
    expect(next.statusSince).toBe(2_000);
  });

  it("preserves admin manual timing overrides across status changes", () => {
    const previous = {
      id: "ticket-1",
      status: "new",
      createdAt: 1_000,
      statusSince: 1_000,
      statusMs: { new: 500 }
    };

    const next = applyTicketStatusTiming({
      ...previous,
      status: "done",
      updatedAt: 20_000,
      statusSince: 20_000,
      statusMs: { new: 3_600_000, in_progress: 7_200_000 },
      manualTimingOverride: true
    }, previous, 30_000);

    expect(next.statusMs).toEqual({ new: 3_600_000, in_progress: 7_200_000 });
    expect(next.statusSince).toBe(20_000);
    expect(next.manualTimingOverride).toBeUndefined();
  });
});
