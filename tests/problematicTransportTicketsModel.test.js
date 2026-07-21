import { describe, expect, it } from "vitest";
import { biScopeForSession } from "../src/biScopeModel.js";
import {
  filterProblematicTransportRows,
  PROBLEMATIC_TRANSPORT_REASON,
  problematicTransportTicketRows
} from "../src/problematicTransportTicketsModel.js";

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 21, 12);

const fleet = [
  { id: "fleet-a", code: "A-101", depts: ["A"] },
  { id: "fleet-b", code: "B-202", depts: ["B"] }
];

const transportTicket = (patch = {}) => ({
  id: "ticket-1",
  track: "transport",
  status: "in_progress",
  forkliftId: "fleet-a",
  downtimeType: "critical",
  downtimeStart: NOW - 49 * HOUR,
  createdAt: NOW - 50 * HOUR,
  updatedAt: NOW - HOUR,
  ...patch
});

describe("problematic transport tickets model", () => {
  it("requires critical transport downtime and a strict greater-than 48 hour threshold", () => {
    const rows = problematicTransportTicketRows([
      transportTicket({ id: "non-critical", downtimeType: "minor", downtimeStart: NOW - 72 * HOUR }),
      transportTicket({ id: "exact", downtimeStart: NOW - 48 * HOUR }),
      transportTicket({ id: "over", downtimeStart: NOW - 48 * HOUR - 1 })
    ], { fleet, now: NOW });

    expect(rows.map((row) => row.ticket.id)).toEqual(["over"]);
    expect(rows[0].reasons).toEqual([PROBLEMATIC_TRANSPORT_REASON.LONG_DOWNTIME]);
  });

  it("uses the recorded return-to-service or closure time as the downtime end", () => {
    const rows = problematicTransportTicketRows([
      transportTicket({
        id: "returned-before-threshold",
        downtimeStart: NOW - 72 * HOUR,
        backInServiceAt: NOW - 25 * HOUR
      }),
      transportTicket({
        id: "closed-over-threshold",
        status: "done",
        downtimeStart: NOW - 72 * HOUR,
        downtimeEnd: NOW - 20 * HOUR
      })
    ], { fleet, now: NOW });

    expect(rows.map((row) => row.ticket.id)).toEqual(["closed-over-threshold"]);
    expect(rows[0].downtimeMs).toBe(52 * HOUR);
  });

  it("requires a closed ticket and a meaningful positive cost", () => {
    const rows = problematicTransportTicketRows([
      transportTicket({ id: "number", status: "done", downtimeStart: null, closure: { costAmount: 500 } }),
      transportTicket({ id: "numeric-string", status: "closed", downtimeStart: null, closure: { costAmount: "125.50" } }),
      transportTicket({ id: "open-cost", closure: { costAmount: 500 }, downtimeStart: null }),
      transportTicket({ id: "empty", status: "done", downtimeStart: null, closure: { costAmount: "" } }),
      transportTicket({ id: "zero", status: "done", downtimeStart: null, closure: { costAmount: 0 } }),
      transportTicket({ id: "placeholder", status: "done", downtimeStart: null, closure: { costAmount: "--" } })
    ], { fleet, now: NOW });

    expect(rows.map((row) => row.ticket.id)).toEqual(["number", "numeric-string"]);
    expect(rows.map((row) => row.costAmount)).toEqual([500, 125.5]);
  });

  it("uses the structured disproportionate wear marker for unnatural damage", () => {
    const rows = problematicTransportTicketRows([
      transportTicket({ id: "unnatural", downtimeStart: null, wearType: "disproportionate" }),
      transportTicket({ id: "natural", downtimeStart: null, wearType: "natural", description: "נזק לא טבעי" })
    ], { fleet, now: NOW });

    expect(rows).toHaveLength(1);
    expect(rows[0].ticket.id).toBe("unnatural");
    expect(rows[0].reasons).toEqual([PROBLEMATIC_TRANSPORT_REASON.UNNATURAL_DAMAGE]);
  });

  it("returns one row with every matching reason", () => {
    const rows = problematicTransportTicketRows([
      transportTicket({
        status: "done",
        downtimeEnd: NOW,
        wearType: "disproportionate",
        closure: { costAmount: 900, signedAt: NOW }
      })
    ], { fleet, now: NOW });

    expect(rows).toHaveLength(1);
    expect(rows[0].reasons).toEqual([
      PROBLEMATIC_TRANSPORT_REASON.UNNATURAL_DAMAGE,
      PROBLEMATIC_TRANSPORT_REASON.LONG_DOWNTIME,
      PROBLEMATIC_TRANSPORT_REASON.CLOSED_WITH_COST
    ]);
  });

  it("keeps non-critical long downtime tickets only for their independent cost reason", () => {
    const rows = problematicTransportTicketRows([
      transportTicket({
        id: "non-critical-cost",
        downtimeType: "minor",
        status: "done",
        downtimeEnd: NOW,
        closure: { costAmount: 500, signedAt: NOW }
      })
    ], { fleet, now: NOW });

    expect(rows).toHaveLength(1);
    expect(rows[0].reasons).toEqual([PROBLEMATIC_TRANSPORT_REASON.CLOSED_WITH_COST]);
  });

  it("keeps non-critical long downtime tickets only for their independent damage reason", () => {
    const rows = problematicTransportTicketRows([
      transportTicket({
        id: "non-critical-damage",
        downtimeType: "has_replacement",
        wearType: "disproportionate"
      })
    ], { fleet, now: NOW });

    expect(rows).toHaveLength(1);
    expect(rows[0].reasons).toEqual([PROBLEMATIC_TRANSPORT_REASON.UNNATURAL_DAMAGE]);
  });

  it("does not infer critical downtime for legacy tickets without the structured flag", () => {
    const rows = problematicTransportTicketRows([
      {
        id: "legacy-long-downtime",
        forkliftId: "fleet-a",
        status: "in_progress",
        downtimeStart: NOW - 72 * HOUR,
        createdAt: NOW - 72 * HOUR
      },
      {
        id: "legacy-critical",
        forkliftId: "fleet-a",
        status: "in_progress",
        downtime_type: "critical",
        downtimeStart: NOW - 72 * HOUR,
        createdAt: NOW - 72 * HOUR
      }
    ], { fleet, now: NOW });

    expect(rows.map((row) => row.ticket.id)).toEqual(["legacy-critical"]);
    expect(rows[0].reasons).toEqual([PROBLEMATIC_TRANSPORT_REASON.LONG_DOWNTIME]);
  });

  it("excludes a T-001-like non-critical ticket with long elapsed downtime only", () => {
    const rows = problematicTransportTicketRows([
      transportTicket({
        id: "T-001-194340",
        asset: "194340",
        downtimeType: "minor",
        downtimeStart: NOW - 10 * 24 * HOUR
      })
    ], { fleet, now: NOW });

    expect(rows).toEqual([]);
  });

  it("excludes facility tickets and tolerates old transport tickets without optional fields", () => {
    const rows = problematicTransportTicketRows([
      transportTicket({ id: "facility", track: "facility", wearType: "disproportionate" }),
      { id: "old", track: "transport", status: "done", forkliftId: "fleet-a" }
    ], { fleet, now: NOW });

    expect(rows).toEqual([]);
  });

  it("preserves company, department, and unauthorized BI scopes", () => {
    const tickets = [
      transportTicket({ id: "a", forkliftId: "fleet-a", wearType: "disproportionate", downtimeStart: null }),
      transportTicket({ id: "b", forkliftId: "fleet-b", wearType: "disproportionate", downtimeStart: null })
    ];
    const source = { tickets, fleet };
    const company = biScopeForSession({ role: "admin" }, source);
    const department = biScopeForSession({ role: "user", departments: ["A"] }, source);
    const unauthorized = biScopeForSession({ role: "tech" }, source);

    expect(problematicTransportTicketRows(company.tickets, { fleet: company.fleet, now: NOW }).map((row) => row.ticket.id)).toEqual(["a", "b"]);
    expect(problematicTransportTicketRows(department.tickets, { fleet: department.fleet, now: NOW }).map((row) => row.ticket.id)).toEqual(["a"]);
    expect(problematicTransportTicketRows(unauthorized.tickets, { fleet: unauthorized.fleet, now: NOW })).toEqual([]);
  });

  it("enforces the vehicle department for managers even when the reporter belongs to their department", () => {
    const tickets = [
      transportTicket({
        id: "reported-in-a-for-fleet-b",
        forkliftId: "fleet-b",
        createdBy: { dept: "A" },
        wearType: "disproportionate",
        downtimeStart: null
      })
    ];
    const scope = biScopeForSession({ role: "user", departments: ["A"] }, { tickets, fleet });

    expect(scope.tickets.map((ticket) => ticket.id)).toEqual(["reported-in-a-for-fleet-b"]);
    expect(problematicTransportTicketRows(scope.tickets, {
      fleet: scope.fleet,
      allowedFleetIds: scope.fleet.map((unit) => unit.id),
      now: NOW
    })).toEqual([]);
  });

  it("filters the full view by period, criterion, query, and sort without changing criteria", () => {
    const rows = problematicTransportTicketRows([
      transportTicket({ id: "old-cost", status: "done", downtimeStart: null, closure: { costAmount: 800, signedAt: NOW - 45 * 24 * HOUR } }),
      transportTicket({ id: "recent-cost", status: "done", downtimeStart: null, asset: "194340", closure: { costAmount: 200, signedAt: NOW - 5 * 24 * HOUR } }),
      transportTicket({ id: "recent-damage", downtimeStart: null, wearType: "disproportionate", createdAt: NOW - 2 * 24 * HOUR }),
      transportTicket({ id: "long-downtime", downtimeStart: NOW - 60 * HOUR, createdAt: NOW - HOUR })
    ], { fleet, now: NOW });

    expect(filterProblematicTransportRows(rows, { now: NOW, period: "30" }).map((row) => row.ticket.id)).toEqual([
      "recent-damage",
      "long-downtime",
      "recent-cost"
    ]);
    expect(filterProblematicTransportRows(rows, { now: NOW, period: "all", reason: PROBLEMATIC_TRANSPORT_REASON.CLOSED_WITH_COST }).map((row) => row.ticket.id)).toEqual([
      "recent-cost",
      "old-cost"
    ]);
    expect(filterProblematicTransportRows(rows, { now: NOW, period: "all", query: "194340" }).map((row) => row.ticket.id)).toEqual([
      "recent-cost"
    ]);
    expect(filterProblematicTransportRows(rows, { now: NOW, period: "all", sort: "cost_desc" }).map((row) => row.ticket.id).slice(0, 2)).toEqual([
      "old-cost",
      "recent-cost"
    ]);
  });
});
