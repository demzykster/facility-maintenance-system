import { describe, expect, it } from "vitest";

import {
  semanticTicketListGroups,
  ticketListCardSemantics,
  ticketListGroupKey
} from "../src/ticketListSemanticModel.js";

const waitReasonMeta = (reason) => ({
  ball: ["manager_decision", "requester_confirmation"].includes(reason) ? "manager" : "executor"
});

describe("ticket list semantic model", () => {
  it("groups F-010 and F-016 by their waiting supplier instead of legacy routing", () => {
    const common = {
      track: "facility",
      status: "waiting",
      waitingReason: "supplier",
      waitBall: "executor",
      waitingTargetType: "supplier",
      waitingSupplier: "משב מיזוג אוויר"
    };
    const f010 = { ...common, id: "F-010", assignee: "Vadim", routedTech: false };
    const f016 = { ...common, id: "F-016", supplier: "משב מיזוג אוויר", routedTech: true };

    expect(ticketListGroupKey(f010, { waitReasonMeta })).toBe("waiting_supplier");
    expect(ticketListGroupKey(f016, { waitReasonMeta })).toBe("waiting_supplier");
    expect(ticketListCardSemantics(f010, { waitReasonMeta })).toMatchObject({
      responsibility: { label: "אחראי", value: "Vadim" },
      waiting: { label: "ממתינים ל", value: "משב מיזוג אוויר" }
    });
  });

  it.each([
    ["supplier", "waiting_supplier"],
    ["technician", "waiting_technician"],
    ["requester_confirmation", "waiting_requester"],
    ["requester", "waiting_requester"],
    ["manager_decision", "waiting_manager"],
    ["manager", "waiting_manager"],
    ["scheduled_date", "waiting_scheduled"],
    ["scheduled", "waiting_scheduled"],
    ["no_equipment", "waiting_equipment"],
    ["parts", "waiting_other"]
  ])("maps waiting reason %s to %s", (waitingReason, expected) => {
    expect(ticketListGroupKey({ status: "waiting", waitingReason }, { waitReasonMeta })).toBe(expected);
  });

  it("shows explicit missing-target messages instead of borrowing execution fields", () => {
    expect(ticketListCardSemantics({
      track: "facility",
      status: "waiting",
      waitingReason: "supplier",
      supplier: "Execution Co",
      assignee: "Vadim"
    }, { waitReasonMeta }).waiting).toEqual({
      kind: "supplier",
      label: "ממתינים ל",
      value: "לא נבחר ספק"
    });

    expect(ticketListCardSemantics({
      track: "facility",
      status: "waiting",
      waitingReason: "technician"
    }, { waitReasonMeta }).waiting.value).toBe("לא נבחר טכנאי");
  });

  it("uses requester, manager, and date targets without changing responsibility", () => {
    const requester = ticketListCardSemantics({
      track: "facility",
      status: "waiting",
      waitingReason: "requester_confirmation",
      assignee: "Vadim",
      createdBy: { id: "requester-1", name: "Sergey" }
    }, { waitReasonMeta });
    expect(requester).toMatchObject({
      responsibility: { value: "Vadim" },
      waiting: { label: "ממתינים לאישור", value: "Sergey" }
    });

    expect(ticketListCardSemantics({
      status: "waiting",
      waitingReason: "manager_decision"
    }, { waitReasonMeta }).waiting.value).toBe("מנהל מחלקה");

    expect(ticketListCardSemantics({
      status: "waiting",
      waitingReason: "scheduled_date",
      waitingTargetType: "date",
      waitingUntil: "2026-07-25T09:00:00.000Z"
    }, { waitReasonMeta, formatDate: () => "25.07.26" }).waiting).toMatchObject({
      label: "חזרה לטיפול",
      value: "25.07.26"
    });
  });

  it("preserves transport and facility execution semantics outside waiting", () => {
    const fleet = [{ id: "fork-1", supplier: "Toyota" }];
    expect(ticketListGroupKey({
      track: "transport",
      status: "new",
      forkliftId: "fork-1",
      routedTech: true,
      assignee: ""
    }, { fleet })).toBe("execution_supplier");
    expect(ticketListGroupKey({
      track: "transport",
      status: "in_progress",
      forkliftId: "fork-1",
      routedTech: true,
      assignee: "Igor"
    }, { fleet })).toBe("execution_technician");
    expect(ticketListGroupKey({
      track: "facility",
      status: "new",
      routedTech: false,
      assignee: ""
    }, { fleet })).toBe("execution_admin");
    expect(ticketListGroupKey({
      track: "facility",
      status: "in_progress",
      mgrExec: true,
      assignee: "Manager"
    }, { fleet })).toBe("execution_manager");
  });

  it("assigns every ticket exactly once and retains legacy waiting tickets", () => {
    const tickets = [
      { id: "supplier", status: "waiting", waitingReason: "supplier" },
      { id: "legacy", status: "waiting", waitingReason: "legacy_custom_reason", waitBall: "executor" },
      { id: "admin", track: "facility", status: "new" },
      { id: "rework", track: "facility", status: "rework", routedTech: true, assignee: "Igor" }
    ];
    const groups = semanticTicketListGroups(tickets, { waitReasonMeta });
    expect(groups.flatMap((group) => group.tickets.map((ticket) => ticket.id))).toEqual([
      "supplier", "legacy", "admin", "rework"
    ]);
    expect(new Set(groups.flatMap((group) => group.tickets.map((ticket) => ticket.id))).size).toBe(tickets.length);
  });
});
