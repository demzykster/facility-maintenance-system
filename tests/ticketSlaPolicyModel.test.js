import { describe, expect, it, vi } from "vitest";
import {
  resolveTicketSlaHours,
  synchronizeOpenTicketSlaWithPolicy,
  ticketSlaDueAt
} from "../src/ticketSlaPolicyModel.js";

describe("ticket SLA policy model", () => {
  it("resolves facility category SLA from current config", () => {
    const hours = resolveTicketSlaHours(
      { track: "facility", category: "hvac", priority: "high" },
      { catSla: { hvac: { high: 6 } } },
      []
    );

    expect(hours).toBe(6);
  });

  it("resolves transport SLA by mapped vehicle type before model fallback", () => {
    const hours = resolveTicketSlaHours(
      { track: "transport", forkliftId: "fork-1", priority: "medium" },
      {
        modelType: { RRE200H: "Reach Truck" },
        typeSla: {
          "Reach Truck": { medium: 18 },
          RRE200H: { medium: 36 }
        }
      },
      [{ id: "fork-1", type: "RRE200H", model: "RRE200H" }]
    );

    expect(hours).toBe(18);
  });

  it("calculates dueAt from the existing SLA base timestamp", () => {
    const due = ticketSlaDueAt(
      { track: "facility", category: "hvac", priority: "medium", approvedAt: 1_000, createdAt: 100 },
      { catSla: { hvac: { medium: 2 } } },
      []
    );

    expect(due).toMatchObject({ ok: true, baseAt: 1_000, dueAt: 1_000 + 2 * 3600000 });
  });

  it("synchronizes only affected open tickets and preserves closed history", async () => {
    const updateTicket = vi.fn().mockResolvedValue(undefined);
    const previousConfig = { catSla: { hvac: { high: 4 } } };
    const nextConfig = { catSla: { hvac: { high: 6 } } };
    const tickets = [
      { id: "open-1", status: "new", track: "facility", category: "hvac", priority: "high", createdAt: 1_000, dueAt: 1_000 + 4 * 3600000 },
      { id: "done-1", status: "done", track: "facility", category: "hvac", priority: "high", createdAt: 2_000, dueAt: 2_000 + 4 * 3600000 },
      { id: "manual-1", status: "new", track: "facility", category: "hvac", priority: "high", createdAt: 3_000, dueAt: 3_000 + 8 * 3600000, slaHoursOverride: 8 },
      { id: "ambiguous-1", status: "new", track: "facility", category: "hvac", priority: "mystery", createdAt: 4_000, dueAt: null }
    ];

    const summary = await synchronizeOpenTicketSlaWithPolicy({
      previousConfig,
      nextConfig,
      tickets,
      updateTicket,
      now: 99_000
    });

    expect(summary).toEqual({ checked: 3, updated: 1, skipped: 2, ambiguous: 1, failed: 0, policyChanged: true });
    expect(updateTicket).toHaveBeenCalledTimes(1);
    expect(updateTicket).toHaveBeenCalledWith(expect.objectContaining({
      id: "open-1",
      dueAt: 1_000 + 6 * 3600000,
      slaPolicySyncedAt: 99_000
    }));
  });

  it("does not scan tickets when SLA policy fields did not change", async () => {
    const updateTicket = vi.fn();
    const summary = await synchronizeOpenTicketSlaWithPolicy({
      previousConfig: { companyName: "A", catSla: { hvac: { high: 4 } } },
      nextConfig: { companyName: "B", catSla: { hvac: { high: 4 } } },
      tickets: [{ id: "open-1", status: "new", createdAt: 1_000, dueAt: null }],
      updateTicket
    });

    expect(summary).toEqual({ checked: 0, updated: 0, skipped: 0, ambiguous: 0, failed: 0, policyChanged: false });
    expect(updateTicket).not.toHaveBeenCalled();
  });
});
