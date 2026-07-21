import { describe, expect, it } from "vitest";
import {
  nextResponsiblePartyRows,
  ticketMatchesNextResponsibleParty,
  ticketNextResponsibleParty
} from "../src/biNextResponsiblePartyModel.js";
import { biScopeForSession } from "../src/biScopeModel.js";

const users = [
  { id: "manager-a", role: "user", name: "Manager A", departments: ["A"] },
  { id: "manager-b", role: "user", name: "Manager B", departments: ["B"] }
];

const fleet = [
  { id: "fleet-a", code: "A-101", supplier: "Toyota", departments: ["A"] },
  { id: "fleet-b", code: "B-202", supplier: "Jungheinrich", departments: ["B"] }
];

describe("BI next responsible party model", () => {
  it("aggregates transport supplier queue separately from accepted technician execution", () => {
    const rows = nextResponsiblePartyRows([
      { id: "queue", track: "transport", status: "new", forkliftId: "fleet-a", supplier: "Toyota", routedTech: true },
      { id: "accepted", track: "transport", status: "in_progress", forkliftId: "fleet-a", supplier: "Toyota", assignee: "Sharon", routedTech: true }
    ], { fleet, users });

    expect(rows.map((row) => [row.key, row.label, row.n])).toEqual([
      ["technician:sharon", "Sharon", 1],
      ["transport_supplier_queue:toyota", "Toyota", 1]
    ]);
  });

  it("keeps facility contractor metadata out of the transport supplier queue", () => {
    const party = ticketNextResponsibleParty({
      id: "facility-contractor",
      track: "facility",
      status: "in_progress",
      supplier: "משב מיזוג",
      assignee: "Vadim",
      routedTech: true
    }, { fleet, users });

    expect(party).toMatchObject({
      type: "internal_admin",
      key: "internal_admin:vadim",
      label: "Vadim"
    });
  });

  it("uses explicit waiting supplier and requester targets before execution owner", () => {
    const rows = nextResponsiblePartyRows([
      {
        id: "supplier-wait",
        track: "facility",
        status: "waiting",
        waitingReason: "supplier",
        waitingTargetType: "supplier",
        waitingSupplier: "משב מיזוג",
        assignee: "Vadim"
      },
      {
        id: "requester-wait",
        track: "facility",
        status: "waiting",
        waitingReason: "requester_confirmation",
        waitingTargetType: "user",
        createdBy: { id: "worker-a", name: "Sergey", role: "worker", department: "A" },
        assignee: "Vadim"
      }
    ], { fleet, users });

    expect(rows.map((row) => [row.key, row.label, row.description])).toEqual([
      ["waiting_supplier:משב מיזוג", "משב מיזוג", "ממתינים לספק"],
      ["requester:sergey", "Sergey", "אישור הפותח"]
    ]);
  });

  it("resolves manager approval to the department manager without using a worker creator as the next party", () => {
    const party = ticketNextResponsibleParty({
      id: "approval",
      track: "transport",
      status: "pending_user",
      forkliftId: "fleet-a",
      supplier: "Toyota",
      assignee: "Sharon",
      createdBy: { id: "worker-a", name: "Worker A", role: "worker", department: "A" }
    }, { fleet, users });

    expect(party).toMatchObject({
      type: "manager",
      key: "manager:manager a",
      label: "Manager A",
      description: "אישור סיום"
    });
  });

  it("uses the same key for BI drill-down filtering", () => {
    const target = { id: "one", track: "transport", status: "in_progress", forkliftId: "fleet-a", supplier: "Toyota", assignee: "Sharon" };
    const other = { id: "two", track: "transport", status: "in_progress", forkliftId: "fleet-a", supplier: "Toyota", assignee: "Dana" };
    const key = ticketNextResponsibleParty(target, { fleet, users }).key;

    expect(ticketMatchesNextResponsibleParty(target, key, { fleet, users })).toBe(true);
    expect(ticketMatchesNextResponsibleParty(other, key, { fleet, users })).toBe(false);
  });

  it("preserves company and department BI scopes before aggregating next responsibility", () => {
    const tickets = [
      { id: "a", track: "transport", status: "new", forkliftId: "fleet-a", supplier: "Toyota", routedTech: true },
      { id: "b", track: "transport", status: "new", forkliftId: "fleet-b", supplier: "Jungheinrich", routedTech: true }
    ];

    const company = biScopeForSession({ role: "admin" }, { tickets, fleet, users });
    const department = biScopeForSession({ role: "user", departments: ["A"] }, { tickets, fleet, users });
    const unauthorized = biScopeForSession({ role: "tech" }, { tickets, fleet, users });

    expect(nextResponsiblePartyRows(company.tickets, { fleet: company.fleet, users: company.users }).map((row) => row.label)).toEqual(["Jungheinrich", "Toyota"]);
    expect(nextResponsiblePartyRows(department.tickets, { fleet: department.fleet, users: department.users }).map((row) => row.label)).toEqual(["Toyota"]);
    expect(nextResponsiblePartyRows(unauthorized.tickets, { fleet: unauthorized.fleet, users: unauthorized.users })).toEqual([]);
  });

  it("keeps ambiguous waiting targets visible instead of assigning them randomly", () => {
    const rows = nextResponsiblePartyRows([
      { id: "missing", track: "facility", status: "waiting", waitingReason: "supplier", assignee: "Vadim" }
    ], { fleet, users });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: "unclear:waiting_supplier",
      type: "unclear",
      label: "דורש בירור שיוך"
    });
  });
});
