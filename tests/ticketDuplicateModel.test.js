import { describe, expect, it } from "vitest";
import { transportDuplicateReview } from "../src/ticketDuplicateModel.js";

const target = { id: "new", track: "transport", forkliftId: "forklift-7", createdAt: 1_000 };

describe("transport duplicate review", () => {
  it("blocks on open tickets for the same transport unit only", () => {
    const review = transportDuplicateReview(target, [
      { id: "open-same", track: "transport", forkliftId: "forklift-7", status: "waiting", createdAt: 300 },
      { id: "closed-same", track: "transport", forkliftId: "forklift-7", status: "done", createdAt: 900 },
      { id: "open-other", track: "transport", forkliftId: "forklift-9", status: "new", createdAt: 950 },
      { id: "facility", track: "facility", status: "new", subject: "forklift-7", createdAt: 980 }
    ]);

    expect(review.mode).toBe("open");
    expect(review.tickets.map((ticket) => ticket.id)).toEqual(["open-same"]);
  });

  it("shows recent closed tickets for the same unit when no open tickets exist", () => {
    const review = transportDuplicateReview(target, [
      { id: "old-closed", track: "transport", forkliftId: "forklift-7", status: "done", createdAt: 100 },
      { id: "recent-closed", track: "transport", forkliftId: "forklift-7", status: "cancelled", createdAt: 900 },
      { id: "closed-other", track: "transport", forkliftId: "forklift-9", status: "done", createdAt: 950 }
    ]);

    expect(review.mode).toBe("closed");
    expect(review.tickets.map((ticket) => ticket.id)).toEqual(["recent-closed", "old-closed"]);
  });

  it("does not review non-transport or transport tickets without a selected unit", () => {
    expect(transportDuplicateReview({ track: "facility" }, [{ id: "open", status: "new" }])).toEqual({ mode: "none", tickets: [] });
    expect(transportDuplicateReview({ track: "transport" }, [{ id: "open", status: "new" }])).toEqual({ mode: "none", tickets: [] });
  });
});
