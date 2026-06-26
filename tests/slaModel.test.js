import { describe, expect, it } from "vitest";
import { isOperationallyOverdue, metOperationalSla, operationalElapsedMs, operationalRemainingMs, operationalSlaRatio, pausedMs } from "../src/slaModel.js";

describe("operational SLA model", () => {
  it("subtracts accumulated and active paused time from elapsed SLA", () => {
    const ticket = { createdAt: 0, dueAt: 10_000, pauseAccumMs: 2_000, pauseSince: 7_000 };

    expect(pausedMs(ticket, 9_000)).toBe(4_000);
    expect(operationalElapsedMs(ticket, 9_000)).toBe(5_000);
    expect(operationalRemainingMs(ticket, 9_000)).toBe(5_000);
  });

  it("detects open operational SLA breaches after paused time is removed", () => {
    const ticket = { status: "waiting", createdAt: 0, dueAt: 10_000, pauseAccumMs: 5_000 };

    expect(isOperationallyOverdue(ticket, 14_000)).toBe(false);
    expect(isOperationallyOverdue(ticket, 16_000)).toBe(true);
  });

  it("scores closed tickets against operational time, not calendar time", () => {
    const ticket = { status: "done", createdAt: 0, dueAt: 10_000, pauseAccumMs: 6_000, closure: { signedAt: 15_000 } };

    expect(metOperationalSla(ticket)).toBe(true);
    expect(operationalSlaRatio(ticket)).toBe(0.9);
  });
});
