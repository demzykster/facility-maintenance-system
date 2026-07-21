import { describe, expect, it } from "vitest";

import {
  getTicketApprovalContext,
  semanticTicketListGroups,
  ticketListCardSemantics,
  ticketListGroupKey
} from "../src/ticketListSemanticModel.js";

const waitReasonMeta = (reason) => ({
  ball: ["manager_decision", "requester_confirmation"].includes(reason) ? "manager" : "executor"
});

const fleet = [
  { id: "fork-a", supplier: "Toyota", dept: "Warehouse" },
  { id: "fork-b", supplier: "Jungheinrich", dept: "Dispatch" }
];

const users = [
  { id: "manager-a", name: "Maya", role: "user", dept: "Warehouse", active: true },
  { id: "manager-b", name: "Dan", role: "user", depts: ["Dispatch"], active: true },
  { id: "worker-a", name: "Worker", role: "worker", dept: "Warehouse", active: true }
];

const options = {
  fleet,
  users,
  waitReasonMeta,
  formatDateTime: (value) => value ? "25.07.26 09:00" : ""
};

describe("ticket list canonical semantic model", () => {
  it("keeps an unaccepted transport ticket in the supplier technician queue", () => {
    const ticket = {
      track: "transport",
      status: "new",
      forkliftId: "fork-a",
      supplier: "Legacy supplier",
      routedTech: true,
      assignee: ""
    };

    expect(ticketListGroupKey(ticket, options)).toBe("transport_supplier_queue");
    expect(ticketListCardSemantics(ticket, options)).toMatchObject({
      responsibility: { label: "טכנאי", value: "טרם נבחר" },
      executionRows: [
        { kind: "supplier", label: "ספק", value: "Toyota" },
        { kind: "technician", label: "טכנאי", value: "טרם נבחר" }
      ]
    });
  });

  it("shows the accepted transport technician together with the execution supplier", () => {
    const ticket = {
      track: "transport",
      status: "in_progress",
      forkliftId: "fork-a",
      routedTech: true,
      assignee: "Sharon"
    };

    expect(ticketListGroupKey(ticket, options)).toBe("execution_technician");
    expect(ticketListCardSemantics(ticket, options).executionRows).toEqual([
      { kind: "technician", label: "טכנאי", value: "Sharon", tone: "process" },
      { kind: "supplier", label: "ספק", value: "Toyota", tone: "supplier" }
    ]);
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
    expect(ticketListGroupKey({ status: "waiting", waitingReason }, options)).toBe(expected);
  });

  it("keeps transport execution context while the accepted technician is waiting", () => {
    const semantics = ticketListCardSemantics({
      track: "transport",
      status: "waiting",
      waitingReason: "parts",
      forkliftId: "fork-a",
      routedTech: true,
      assignee: "Sharon"
    }, options);

    expect(ticketListGroupKey({
      track: "transport",
      status: "waiting",
      waitingReason: "parts",
      forkliftId: "fork-a",
      routedTech: true,
      assignee: "Sharon"
    }, options)).toBe("waiting_other");
    expect(semantics.executionRows.map((row) => [row.label, row.value])).toEqual([
      ["טכנאי", "Sharon"],
      ["ספק", "Toyota"]
    ]);
    expect(semantics.waiting).toMatchObject({ label: "ממתינים ל", value: "חלקים" });
  });

  it("maps technician completion to department-manager approval", () => {
    const managerCreated = {
      track: "transport",
      status: "pending_user",
      forkliftId: "fork-a",
      assignee: "Sharon",
      createdBy: { id: "manager-a", name: "Maya", role: "user", dept: "Warehouse" }
    };
    const workerCreated = {
      track: "transport",
      status: "pending_user",
      forkliftId: "fork-a",
      assignee: "Sharon",
      createdBy: { id: "worker-a", name: "Worker", role: "worker", dept: "Warehouse" }
    };

    expect(ticketListGroupKey(managerCreated, options)).toBe("approval_manager");
    expect(getTicketApprovalContext(managerCreated, options)).toMatchObject({
      type: "manager_completion",
      target: { id: "manager-a", name: "Maya" }
    });
    expect(getTicketApprovalContext(workerCreated, options)).toMatchObject({
      type: "manager_completion",
      target: { id: "manager-a", name: "Maya" }
    });
    expect(ticketListCardSemantics(workerCreated, options).approval).toEqual({
      kind: "manager_approval",
      label: "ממתינים לאישור",
      value: "Maya"
    });
  });

  it("keeps rework with the same transport technician and supplier", () => {
    const ticket = {
      track: "transport",
      status: "in_progress",
      returned: true,
      forkliftId: "fork-a",
      routedTech: true,
      assignee: "Sharon"
    };

    expect(ticketListGroupKey(ticket, options)).toBe("rework");
    expect(ticketListCardSemantics(ticket, options)).toMatchObject({
      lifecycle: { stage: "rework" },
      executionRows: [
        { kind: "technician", value: "Sharon" },
        { kind: "supplier", value: "Toyota" }
      ]
    });
  });

  it("puts manager-approved tickets in administrative closure", () => {
    const ticket = { track: "transport", status: "pending_admin", forkliftId: "fork-a", assignee: "Sharon" };
    expect(ticketListGroupKey(ticket, options)).toBe("approval_admin");
    expect(ticketListCardSemantics(ticket, options).approval).toEqual({
      kind: "admin_closure",
      label: "ממתינות לסגירה",
      value: "מנהל המערכת"
    });
  });

  it("does not turn a facility contractor into a transport supplier queue", () => {
    const ticket = {
      track: "facility",
      status: "new",
      supplier: "Building Co",
      routedTech: true,
      assignee: ""
    };

    expect(ticketListGroupKey(ticket, options)).toBe("triage_admin");
    expect(ticketListCardSemantics(ticket, options)).toMatchObject({
      responsibility: { label: "אחראי", value: "מנהל המערכת" },
      executionRows: [
        { kind: "responsible", label: "אחראי", value: "מנהל המערכת" },
        { kind: "contractor", label: "ספק / קבלן", value: "Building Co" }
      ]
    });
  });

  it("separates facility internal and manager execution", () => {
    expect(ticketListGroupKey({
      track: "facility",
      status: "in_progress",
      assignee: "Vadim"
    }, options)).toBe("execution_facility");
    expect(ticketListGroupKey({
      track: "facility",
      status: "in_progress",
      mgrExec: true,
      assignee: "Maya"
    }, options)).toBe("execution_manager");
  });

  it("keeps the facility owner while waiting for a contractor", () => {
    const semantics = ticketListCardSemantics({
      track: "facility",
      status: "waiting",
      assignee: "Vadim",
      supplier: "Execution Co",
      waitingReason: "supplier",
      waitingTargetType: "supplier",
      waitingSupplier: "Quote Co"
    }, options);

    expect(semantics.executionRows).toEqual([
      { kind: "responsible", label: "אחראי", value: "Vadim", tone: "info" },
      { kind: "contractor", label: "ספק / קבלן", value: "Execution Co", tone: "supplier" }
    ]);
    expect(semantics.waiting).toMatchObject({ label: "ממתינים ל", value: "Quote Co" });
  });

  it("does not borrow an execution supplier for a missing waiting target", () => {
    const semantics = ticketListCardSemantics({
      track: "facility",
      status: "waiting",
      waitingReason: "supplier",
      supplier: "Execution Co",
      assignee: "Vadim"
    }, options);
    expect(semantics.waiting).toEqual({
      kind: "supplier",
      label: "ממתינים ל",
      value: "לא נבחר ספק"
    });
  });

  it("shows requester, manager, and scheduled targets explicitly", () => {
    expect(ticketListCardSemantics({
      track: "facility",
      status: "waiting",
      waitingReason: "requester_confirmation",
      assignee: "Vadim",
      createdBy: { id: "requester-1", name: "Sergey" }
    }, options).waiting).toMatchObject({ label: "ממתינים לאישור", value: "Sergey" });

    expect(ticketListCardSemantics({
      track: "facility",
      status: "waiting",
      waitingReason: "manager_decision",
      waitingTargetType: "manager",
      waitingUser: { id: "manager-a", name: "Maya" }
    }, options).waiting).toMatchObject({ label: "ממתינים ל", value: "Maya" });

    expect(ticketListCardSemantics({
      track: "facility",
      status: "waiting",
      waitingReason: "scheduled_date",
      waitingTargetType: "date",
      waitingUntil: "2026-07-25T09:00:00.000Z"
    }, options)).toMatchObject({
      scheduled: { label: "חזרה לטיפול", value: "25.07.26 09:00" }
    });
  });

  it("shows SLA separately from a scheduled return date", () => {
    const semantics = ticketListCardSemantics({
      track: "facility",
      status: "waiting",
      waitingReason: "scheduled_date",
      waitingTargetType: "date",
      waitingUntil: "2026-07-25T09:00:00.000Z",
      dueAt: "2026-07-22T09:00:00.000Z"
    }, options);

    expect(semantics.sla).toEqual({ label: "יעד SLA", value: "25.07.26 09:00" });
    expect(semantics.scheduled).toEqual({ label: "חזרה לטיפול", value: "25.07.26 09:00" });
    expect(semantics.waiting?.label).not.toBe("יעד המתנה");
  });

  it("uses an explicit SLA fallback for open legacy tickets", () => {
    expect(ticketListCardSemantics({ track: "facility", status: "new" }, options).sla).toEqual({
      label: "יעד SLA",
      value: "לא הוגדר"
    });
  });

  it("assigns every open ticket exactly once and retains unknown legacy tickets", () => {
    const tickets = [
      { id: "queue", track: "transport", status: "new", forkliftId: "fork-a", routedTech: true },
      { id: "waiting", track: "facility", status: "waiting", waitingReason: "legacy_custom_reason" },
      { id: "approval", track: "transport", status: "pending_user", forkliftId: "fork-a", assignee: "Sharon" },
      { id: "admin", track: "facility", status: "new" },
      { id: "unknown", track: "transport", status: "new", routedTech: false }
    ];
    const groups = semanticTicketListGroups(tickets, options);
    const ids = groups.flatMap((group) => group.tickets.map((ticket) => ticket.id));

    expect(ids).toHaveLength(tickets.length);
    expect(new Set(ids).size).toBe(tickets.length);
    expect(ids).toEqual(expect.arrayContaining(tickets.map((ticket) => ticket.id)));
  });
});
