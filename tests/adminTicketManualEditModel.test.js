import { describe, expect, it } from "vitest";
import { applyAdminTicketManualEdit, statusHoursToMs } from "../src/adminTicketManualEditModel.js";

describe("admin ticket manual edit model", () => {
  it("builds manual status durations for retroactive statistics", () => {
    expect(statusHoursToMs({
      new: "1.5",
      in_progress: "2",
      "waiting:parts": "",
      rework: "-1"
    })).toEqual({
      new: 5_400_000,
      in_progress: 7_200_000
    });
  });

  it("updates route, closure, historical dates and appends an admin audit entry", () => {
    const ticket = {
      id: "t1",
      subject: "Old subject",
      description: "Old desc",
      status: "new",
      supplier: "",
      assignee: "",
      createdAt: 1_000,
      updatedAt: 1_000,
      log: [{ at: 1_000, by: "User", byRole: "user", text: "opened" }]
    };

    const next = applyAdminTicketManualEdit(ticket, {
      subject: "Imported repair",
      description: "Historical ticket",
      status: "done",
      supplier: "Supplier A",
      assignee: "Tech A",
      createdAt: "2026-07-01T08:00",
      updatedAt: "2026-07-03T10:00",
      dueAt: "2026-07-02T08:00",
      closureSignedAt: "2026-07-03T10:00",
      costAmount: "250",
      costSupplier: "Supplier A",
      costNote: "invoice 1",
      quality: "temporary",
      statusHours: { new: "4", in_progress: "44" },
      historyText: "טכנאי הגיע לשטח",
      historyAt: "2026-07-02T09:00"
    }, {
      session: { name: "Admin", role: "admin" },
      now: 2_000
    });

    expect(next.subject).toBe("Imported repair");
    expect(next.status).toBe("done");
    expect(next.supplier).toBe("Supplier A");
    expect(next.assignee).toBe("Tech A");
    expect(next.dueAt).toBeGreaterThan(next.createdAt);
    expect(next.closure).toMatchObject({
      costAmount: 250,
      costSupplier: "Supplier A",
      costNote: "invoice 1",
      quality: "temporary",
      signedBy: "Admin"
    });
    expect(next.statusMs).toEqual({ new: 14_400_000, in_progress: 158_400_000 });
    expect(next.manualTimingOverride).toBe(true);
    expect(next.log.map((entry) => entry.kind)).toContain("admin_manual");
    expect(next.log.map((entry) => entry.kind)).toContain("history");
  });
});
