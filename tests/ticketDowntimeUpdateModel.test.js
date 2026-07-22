import { describe, expect, it } from "vitest";
import { applyTicketDowntimeUpdate } from "../src/ticketDowntimeUpdateModel.js";

const HOUR = 3600000;

describe("ticket downtime update model", () => {
  const config = {
    transportSlaHours: { forklift: { high: 4, medium: 24, low: 72 } },
    downtimeLevels: [
      { id: "minor", label: "תקלה לטיפול או בדיקה", prio: "low", color: "#16A34A" },
      { id: "has_replacement", label: "תקלה שאינה מוציאה מכלל שימוש", prio: "medium", color: "#CA8A04" },
      { id: "critical", label: "תקלה קריטית - אין גיבוי", prio: "high", color: "#DC2626", oos: true }
    ]
  };
  const fleet = [{ id: "forklift-210", type: "forklift" }];
  const baseTicket = {
    id: "T-downtime",
    track: "transport",
    status: "in_progress",
    category: "transport",
    forkliftId: "forklift-210",
    downtimeType: "minor",
    priority: "low",
    createdAt: 1000,
    dueAt: 1000 + 72 * HOUR,
    log: [{ at: 1000, by: "Admin", byRole: "admin", text: "נפתחה" }]
  };

  it("updates transport downtime type and derived SLA priority for an admin", () => {
    const result = applyTicketDowntimeUpdate(baseTicket, "critical", {
      actor: { role: "admin", name: "Vadim" },
      config,
      fleet,
      now: 5000
    });

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.before).toEqual({ downtimeType: "minor", priority: "low", dueAt: 1000 + 72 * HOUR });
    expect(result.after).toEqual({ downtimeType: "critical", priority: "high", dueAt: 1000 + 4 * HOUR });
    expect(result.ticket).toMatchObject({
      id: "T-downtime",
      track: "transport",
      status: "in_progress",
      downtimeType: "critical",
      priority: "high",
      dueAt: 1000 + 4 * HOUR,
      updatedAt: 5000
    });
    expect(result.ticket.log.at(-1)).toMatchObject({
      kind: "downtime_type",
      downtimeTypeBefore: "minor",
      downtimeTypeAfter: "critical",
      priorityBefore: "low",
      priorityAfter: "high"
    });
  });

  it("rejects non-admin actors", () => {
    const result = applyTicketDowntimeUpdate(baseTicket, "critical", {
      actor: { role: "tech", name: "Sharon" },
      config,
      fleet
    });

    expect(result).toEqual({ ok: false, error: "ticket_downtime_update_forbidden" });
  });

  it("rejects facility tickets", () => {
    const result = applyTicketDowntimeUpdate({ ...baseTicket, track: "facility", forkliftId: null }, "critical", {
      actor: { role: "admin", name: "Vadim" },
      config,
      fleet
    });

    expect(result).toEqual({ ok: false, error: "ticket_downtime_update_unsupported_track" });
  });

  it("rejects values outside the configured transport downtime levels", () => {
    const result = applyTicketDowntimeUpdate(baseTicket, "needs_triage", {
      actor: { role: "admin", name: "Vadim" },
      config,
      fleet
    });

    expect(result).toEqual({ ok: false, error: "ticket_downtime_update_invalid" });
  });

  it("does not create history when downtime type and derived priority are unchanged", () => {
    const result = applyTicketDowntimeUpdate(baseTicket, "minor", {
      actor: { role: "admin", name: "Vadim" },
      config,
      fleet
    });

    expect(result).toEqual({ ok: true, changed: false, ticket: baseTicket });
  });

  it("uses the original SLA base timestamp, not now", () => {
    const result = applyTicketDowntimeUpdate({ ...baseTicket, slaBaseAt: 2000 }, "has_replacement", {
      actor: { role: "admin", name: "Vadim" },
      config,
      fleet,
      now: 1000000
    });

    expect(result.ok).toBe(true);
    expect(result.ticket.dueAt).toBe(2000 + 24 * HOUR);
  });
});
