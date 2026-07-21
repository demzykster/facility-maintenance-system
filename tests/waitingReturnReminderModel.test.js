import { describe, expect, it } from "vitest";
import { waitingReturnReminderEventsForSession } from "../src/waitingReturnReminderModel.js";

const baseTicket = {
  id: "ticket-1",
  num: 12,
  track: "facility",
  status: "waiting",
  waitingReason: "scheduled_date",
  waitingTargetType: "date",
  waitingUntil: 10_000,
  subject: "Door",
  createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" },
  department: "Ops"
};

describe("waiting return reminder model", () => {
  it("notifies the current internal owner when waitingUntil has arrived", () => {
    const events = waitingReturnReminderEventsForSession({
      session: { id: "admin-1", role: "admin" },
      tickets: [baseTicket],
      now: 20_000,
      ticketNo: (ticket) => `F-${ticket.num}`,
      trackLabel: () => "מבנה"
    });

    expect(events).toEqual([{
      key: "wait-return-ticket-1-10000",
      at: 10_000,
      ticketId: "ticket-1",
      kind: "waiting",
      go: "tickets",
      title: "חזרה לטיפול · #F-12",
      body: "מבנה · Door"
    }]);
  });

  it("does not notify before the scheduled return date", () => {
    const events = waitingReturnReminderEventsForSession({
      session: { id: "admin-1", role: "admin" },
      tickets: [baseTicket],
      now: 9_000
    });

    expect(events).toEqual([]);
  });

  it("does not notify unauthorized or non-responsible roles", () => {
    const events = waitingReturnReminderEventsForSession({
      session: { id: "worker-1", role: "worker" },
      tickets: [baseTicket],
      now: 20_000
    });

    expect(events).toEqual([]);
  });

  it("notifies a transport technician only for visible tickets in their execution scope", () => {
    const tickets = [
      { id: "toyota", track: "transport", status: "waiting", waitingReason: "parts", waitingUntil: 1_000, supplier: "Toyota", assignee: "Sharon", subject: "Wheel" },
      { id: "other", track: "transport", status: "waiting", waitingReason: "parts", waitingUntil: 1_000, supplier: "Other", assignee: "Dana", subject: "Battery" }
    ];

    const events = waitingReturnReminderEventsForSession({
      session: { id: "tech-1", role: "tech", name: "Sharon", supplier: "Toyota", techScope: "transport" },
      tickets,
      now: 2_000
    });

    expect(events.map((event) => event.ticketId)).toEqual(["toyota"]);
  });

  it("does not emit reminders for closed or non-waiting tickets", () => {
    const events = waitingReturnReminderEventsForSession({
      session: { id: "admin-1", role: "admin" },
      tickets: [
        { ...baseTicket, id: "done", status: "done" },
        { ...baseTicket, id: "progress", status: "in_progress" }
      ],
      now: 20_000
    });

    expect(events).toEqual([]);
  });
});
