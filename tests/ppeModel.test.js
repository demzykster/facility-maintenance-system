import { describe, expect, it } from "vitest";
import { buildPpeApprovedEvents, ppeRequestLineSummary, ppeRequestStatusLabel } from "../src/ppeModel.js";

describe("PPE request model", () => {
  it("uses explicit labels for request statuses", () => {
    expect(ppeRequestStatusLabel("pending")).toBe("ממתינה לאישור מנהל");
    expect(ppeRequestStatusLabel("worker_sign")).toBe("ממתינה לחתימת העובד");
    expect(ppeRequestStatusLabel("approved")).toBe("אושרה והונפקה");
    expect(ppeRequestStatusLabel("rejected")).toBe("נדחתה");
  });

  it("summarizes PPE request lines", () => {
    expect(ppeRequestLineSummary({
      lines: [
        { itemName: "נעליים", size: "42", qty: 1 },
        { itemName: "חולצה", size: "L", qty: 2 }
      ]
    })).toBe("נעליים (42) · חולצה (L) ×2");
  });

  it("builds recent admin notifications for approved PPE requests only", () => {
    const now = 1_700_000_000_000;
    const events = buildPpeApprovedEvents([
      { id: "old", status: "approved", decidedAt: now - 20 * 86400000, workerName: "Old", lines: [] },
      { id: "pending", status: "pending", decidedAt: now, workerName: "Pending", lines: [] },
      { id: "ok", status: "approved", decidedAt: now - 2 * 86400000, workerName: "דוד", lines: [{ itemName: "קסדה", size: "אחיד", qty: 1 }] }
    ], { now, recentDays: 14 });

    expect(events).toEqual([
      {
        key: "ppe-approved-ok",
        at: now - 2 * 86400000,
        kind: "ppe",
        go: "ppe",
        title: "בקשת ביגוד אושרה והונפקה",
        body: "דוד · קסדה"
      }
    ]);
  });
});
