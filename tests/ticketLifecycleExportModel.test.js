import { describe, expect, it } from "vitest";
import { normalizedTicketLifecycleStages, ticketHasLifecycleStage, ticketLifecycleMissedOperationalSla, ticketLifecycleNonOperationalMs, ticketLifecycleOperationalSlaRatio, ticketLifecycleRows, ticketLifecycleSummary, ticketLifecycleWaitReasonStats } from "../src/ticketLifecycleExportModel.js";

const labels = {
  now: 10_000,
  isOpen: (ticket) => ticket.status !== "done" && ticket.status !== "cancelled",
  statusLabel: (id) => ({ new: "חדשה", in_progress: "בטיפול" }[id] || id),
  waitReasonLabel: (id) => ({ parts: "ממתין לחלקים", no_equipment: "הכלי לא התקבל" }[id] || id),
  waitReasonMeta: (id) => ({
    parts: { ball: "executor", pauseSla: true },
    manager_decision: { ball: "manager", pauseSla: false },
    no_equipment: { ball: "manager", pauseSla: true }
  }[id] || {}),
  wearLabel: (id) => ({ natural: "בלאי טבעי" }[id] || id),
  durationText: (ms) => `${Math.round(ms / 1000)}s`
};

describe("ticket lifecycle export model", () => {
  it("summarizes historic and current status durations", () => {
    const summary = ticketLifecycleSummary({
      status: "waiting",
      waitingReason: "parts",
      statusSince: 7_000,
      statusMs: { new: 2_000, in_progress: 5_000 },
      description: "נזילת שמן",
      wearType: "natural"
    }, labels);

    expect(summary.description).toBe("נזילת שמן");
    expect(summary.sourceClass).toBe("בלאי טבעי");
    expect(summary.statusDurations).toContain("בטיפול: 5s");
    expect(summary.statusDurations).toContain("המתנה · ממתין לחלקים: 3s");
    expect(summary.waitingDurations).toBe("ממתין לחלקים: 3s");
  });

  it("captures return and closure fields without treating them as current state", () => {
    const summary = ticketLifecycleSummary({
      status: "done",
      returned: true,
      returnReason: "הרעש חזר",
      equipWaitMs: 4_000,
      closure: { costNote: "הוחלף גלגל", quality: "likely_repeat" }
    }, labels);

    expect(summary.returned).toBe("כן");
    expect(summary.returnReason).toBe("הרעש חזר");
    expect(summary.equipmentWait).toBe("4s");
    expect(summary.closureNote).toBe("הוחלף גלגל");
    expect(summary.closureQuality).toBe("עשוי לחזור");
  });

  it("builds one lifecycle row per status or waiting duration", () => {
    const rows = ticketLifecycleRows({ status: "done", statusMs: { new: 1_000, "waiting:no_equipment": 2_000 } }, labels);

    expect(rows.map((row) => [row.kind, row.key, row.reason, row.ms])).toEqual([
      ["waiting", "waiting:no_equipment", "no_equipment", 2_000],
      ["status", "new", "", 1_000]
    ]);
  });

  it("normalizes current and historical lifecycle stages", () => {
    const stages = normalizedTicketLifecycleStages({
      status: "waiting",
      waitingReason: "parts",
      statusSince: 7_000,
      statusMs: { new: 2_000, in_progress: 5_000 }
    }, labels);

    expect(stages).toMatchObject([
      { key: "in_progress", kind: "status", label: "בטיפול", ms: 5_000, current: false, owner: "executor" },
      { key: "waiting:parts", kind: "waiting", reason: "parts", label: "ממתין לחלקים", ms: 3_000, current: true, currentStartedAt: 7_000, owner: "executor", countsOperationalSla: false },
      { key: "new", kind: "status", label: "חדשה", ms: 2_000, current: false, owner: "manager" }
    ]);
  });

  it("keeps closed historical waiting stages without a current wait reason", () => {
    const stages = normalizedTicketLifecycleStages({
      status: "done",
      statusMs: { "waiting:parts": 4_000 }
    }, labels);

    expect(stages).toMatchObject([
      { key: "waiting:parts", kind: "waiting", reason: "parts", label: "ממתין לחלקים", ms: 4_000, current: false, owner: "executor", countsOperationalSla: false }
    ]);
  });

  it("adds equipment wait and rework markers for analytics", () => {
    const stages = normalizedTicketLifecycleStages({
      status: "in_progress",
      equipWaitMs: 6_000,
      returned: true,
      returnReason: "לא תקין"
    }, labels);

    expect(stages).toContainEqual(expect.objectContaining({ key: "waiting:no_equipment", kind: "waiting", reason: "no_equipment", label: "הכלי לא התקבל", ms: 6_000, current: false, owner: "manager", countsOperationalSla: false }));
    expect(stages).toContainEqual(expect.objectContaining({ key: "rework", kind: "rework", reason: "", label: "הוחזר לטיפול", ms: 0, current: false, owner: "requester" }));
  });

  it("adds owner and accounting semantics for dashboard and analytics", () => {
    const stages = normalizedTicketLifecycleStages({
      track: "transport",
      status: "waiting",
      waitingReason: "manager_decision",
      waitBall: "manager",
      statusSince: 9_000,
      downtimeStart: 1_000,
      statusMs: { "waiting:parts": 4_000 }
    }, labels);

    expect(stages).toContainEqual(expect.objectContaining({
      key: "waiting:manager_decision",
      owner: "manager",
      countsOperationalSla: true,
      countsDowntime: true,
      appearsIn: { export: true, analytics: true, dashboard: true }
    }));
    expect(stages).toContainEqual(expect.objectContaining({
      key: "waiting:parts",
      owner: "executor",
      countsOperationalSla: false,
      countsDowntime: true
    }));
  });

  it("checks whether a ticket contains a lifecycle stage", () => {
    const ticket = {
      status: "done",
      statusMs: { "waiting:parts": 4_000 },
      returned: true
    };

    expect(ticketHasLifecycleStage(ticket, "waiting:parts", labels)).toBe(true);
    expect(ticketHasLifecycleStage(ticket, "rework", labels)).toBe(true);
    expect(ticketHasLifecycleStage(ticket, "waiting:budget", labels)).toBe(false);
  });

  it("aggregates waiting reasons from historical and current lifecycle stages", () => {
    const stats = ticketLifecycleWaitReasonStats([
      { status: "done", statusMs: { "waiting:parts": 4_000 } },
      { status: "waiting", waitingReason: "no_equipment", equipWaitSince: 8_000 },
      { status: "done", statusMs: { "waiting:parts": 2_000 } }
    ], labels);

    expect(stats).toEqual([
      { reason: "parts", label: "ממתין לחלקים", n: 2, ms: 6_000 },
      { reason: "no_equipment", label: "הכלי לא התקבל", n: 1, ms: 2_000 }
    ]);
  });

  it("uses lifecycle non-operational stages for SLA scoring", () => {
    const ticket = {
      status: "done",
      createdAt: 0,
      dueAt: 10_000,
      closure: { signedAt: 15_000 },
      statusMs: { "waiting:parts": 6_000 }
    };

    expect(ticketLifecycleNonOperationalMs(ticket, labels)).toBe(6_000);
    expect(ticketLifecycleOperationalSlaRatio(ticket, labels)).toBe(0.9);
    expect(ticketLifecycleMissedOperationalSla(ticket, labels)).toBe(false);
  });

  it("falls back to stored pause totals when lifecycle stages do not include paused time", () => {
    const ticket = {
      status: "done",
      createdAt: 0,
      dueAt: 10_000,
      pauseAccumMs: 6_000,
      closure: { signedAt: 15_000 }
    };

    expect(ticketLifecycleNonOperationalMs(ticket, labels)).toBe(6_000);
    expect(ticketLifecycleOperationalSlaRatio(ticket, labels)).toBe(0.9);
    expect(ticketLifecycleMissedOperationalSla(ticket, labels)).toBe(false);
  });
});
