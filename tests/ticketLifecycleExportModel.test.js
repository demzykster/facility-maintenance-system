import { describe, expect, it } from "vitest";
import { normalizedTicketLifecycleStages, ticketHasLifecycleStage, ticketLifecycleRows, ticketLifecycleSummary } from "../src/ticketLifecycleExportModel.js";

const labels = {
  now: 10_000,
  isOpen: (ticket) => ticket.status !== "done" && ticket.status !== "cancelled",
  statusLabel: (id) => ({ new: "חדשה", in_progress: "בטיפול" }[id] || id),
  waitReasonLabel: (id) => ({ parts: "ממתין לחלקים", no_equipment: "הכלי לא התקבל" }[id] || id),
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
      { key: "in_progress", kind: "status", label: "בטיפול", ms: 5_000, current: false },
      { key: "waiting:parts", kind: "waiting", reason: "parts", label: "ממתין לחלקים", ms: 3_000, current: true },
      { key: "new", kind: "status", label: "חדשה", ms: 2_000, current: false }
    ]);
  });

  it("keeps closed historical waiting stages without a current wait reason", () => {
    const stages = normalizedTicketLifecycleStages({
      status: "done",
      statusMs: { "waiting:parts": 4_000 }
    }, labels);

    expect(stages).toEqual([
      { key: "waiting:parts", kind: "waiting", reason: "parts", label: "ממתין לחלקים", ms: 4_000, current: false }
    ]);
  });

  it("adds equipment wait and rework markers for analytics", () => {
    const stages = normalizedTicketLifecycleStages({
      status: "in_progress",
      equipWaitMs: 6_000,
      returned: true,
      returnReason: "לא תקין"
    }, labels);

    expect(stages).toContainEqual({ key: "waiting:no_equipment", kind: "waiting", reason: "no_equipment", label: "הכלי לא התקבל", ms: 6_000, current: false });
    expect(stages).toContainEqual({ key: "rework", kind: "rework", reason: "", label: "הוחזר לטיפול", ms: 0, current: false });
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
});
