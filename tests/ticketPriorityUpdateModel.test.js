import { describe, expect, it } from "vitest";
import { applyTicketPriorityUpdate } from "../src/ticketPriorityUpdateModel.js";

const HOUR = 3600000;

describe("ticket priority update model", () => {
  const baseTicket = {
    id: "F-priority",
    track: "facility",
    status: "in_progress",
    category: "doors",
    subject: "Door",
    priority: "low",
    createdAt: 1000,
    dueAt: 1000 + 72 * HOUR,
    log: [{ at: 1000, by: "Admin", byRole: "admin", text: "נפתחה" }]
  };

  it("updates only priority, dueAt, updatedAt and a history entry for an admin", () => {
    const result = applyTicketPriorityUpdate(baseTicket, "high", {
      actor: { id: "admin-1", role: "admin", name: "Vadim" },
      config: { catSla: { doors: { high: 4, medium: 24, low: 72 } } },
      fleet: [],
      now: 5000
    });

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.before).toEqual({ priority: "low", dueAt: 1000 + 72 * HOUR });
    expect(result.after).toEqual({ priority: "high", dueAt: 1000 + 4 * HOUR });
    expect(result.ticket).toMatchObject({
      id: baseTicket.id,
      track: baseTicket.track,
      status: baseTicket.status,
      category: baseTicket.category,
      subject: baseTicket.subject,
      priority: "high",
      dueAt: 1000 + 4 * HOUR,
      updatedAt: 5000
    });
    expect(result.ticket.log).toHaveLength(2);
    expect(result.ticket.log[1]).toMatchObject({
      by: "Vadim",
      byRole: "admin",
      kind: "priority",
      priorityBefore: "low",
      priorityAfter: "high",
      dueAtBefore: 1000 + 72 * HOUR,
      dueAtAfter: 1000 + 4 * HOUR
    });
  });

  it("rejects non-admin actors", () => {
    const result = applyTicketPriorityUpdate(baseTicket, "high", {
      actor: { role: "tech", name: "Sharon" }
    });

    expect(result).toEqual({ ok: false, error: "ticket_priority_update_forbidden" });
  });

  it("rejects invalid priority values", () => {
    const result = applyTicketPriorityUpdate(baseTicket, "critical", {
      actor: { role: "admin", name: "Vadim" }
    });

    expect(result).toEqual({ ok: false, error: "ticket_priority_invalid" });
  });

  it("does not create history when the priority is unchanged", () => {
    const result = applyTicketPriorityUpdate(baseTicket, "low", {
      actor: { role: "admin", name: "Vadim" }
    });

    expect(result).toEqual({ ok: true, changed: false, ticket: baseTicket });
  });

  it("uses the original SLA base timestamp, not now", () => {
    const result = applyTicketPriorityUpdate({ ...baseTicket, slaBaseAt: 2000, createdAt: 1000 }, "medium", {
      actor: { role: "admin", name: "Vadim" },
      config: { catSla: { doors: { medium: 12 } } },
      now: 1000000
    });

    expect(result.ok).toBe(true);
    expect(result.ticket.dueAt).toBe(2000 + 12 * HOUR);
  });
});
