import { describe, expect, it } from "vitest";
import { biDepartmentRiskRows, biPeriodRange, biScopeForSession, normalizeBiPeriod } from "../src/biScopeModel.js";

const data = {
  tickets: [
    { id: "t-fac-a", track: "facility", reportedBy: { dept: "A" } },
    { id: "t-fac-b", track: "facility", createdBy: { dept: "B" } },
    { id: "t-fleet-a", forkliftId: "f-a" },
    { id: "t-fleet-b", forkliftId: "f-b" }
  ],
  fleet: [
    { id: "f-a", depts: ["A"] },
    { id: "f-b", dept: "B" }
  ],
  pm: [
    { id: "pm-a", fleetId: "f-a" },
    { id: "pm-b", fleetId: "f-b" },
    { id: "pm-a-alt", forkliftId: "f-a" }
  ],
  zones: [
    { id: "z-a", dept: "A" },
    { id: "z-shared", shared: true },
    { id: "z-b", dept: "B" },
    { id: "z-fac-a", name: "Boiler Room", dept: "A" }
  ],
  rounds: [
    { id: "r-a", zoneId: "z-a" },
    { id: "r-shared", zoneId: "z-shared" },
    { id: "r-b", zoneId: "z-b" },
    { id: "r-manual", zoneId: "z-manual" }
  ],
  complaints: [
    { id: "c-a", zoneId: "z-a" },
    { id: "c-shared", zoneId: "z-shared" },
    { id: "c-b", zoneId: "z-b" },
    { id: "c-manual", zoneId: "z-manual" }
  ],
  ppe: [
    { id: "ppe-a", dept: "A" },
    { id: "ppe-b", dept: "B" },
    { id: "ppe-a-item", dept: "A", itemId: "item-a" }
  ],
  ppeItems: [
    { id: "item-a" },
    { id: "item-req-a" },
    { id: "item-b" }
  ],
  ppeReqs: [
    { id: "req-a", workerId: "u-a", dept: "A", lines: [{ itemId: "item-req-a" }] },
    { id: "req-b", workerId: "u-b", dept: "B", lines: [{ itemId: "item-b" }] }
  ],
  ppeOrders: [
    { id: "ord-a" },
    { id: "ord-b" }
  ],
  users: [
    { id: "u-a", role: "worker", dept: "A" },
    { id: "u-b", role: "worker", depts: ["B"] },
    { id: "admin", role: "admin" }
  ],
  tasks: [
    { id: "task-a", responsibleIds: ["u-a"] },
    { id: "task-manager-a", ownerId: "manager-a" },
    { id: "task-b", responsibleIds: ["u-b"] },
    { id: "task-admin", responsibleIds: ["admin"] }
  ],
  meetings: [
    { id: "meeting-a", participantIds: ["u-a"] },
    { id: "meeting-manager-a", ownerId: "manager-a" },
    { id: "meeting-b", participantIds: ["u-b"] },
    { id: "meeting-admin", participantIds: ["admin"] }
  ]
};

describe("BI scope model", () => {
  it("normalizes BI period choices into current and trend windows", () => {
    expect(normalizeBiPeriod("bad")).toBe("now");
    expect(normalizeBiPeriod("30")).toBe("30");

    expect(biPeriodRange("now", 1_000_000)).toMatchObject({ id: "now", trendDays: 7, evidenceDays: 30 });
    expect(biPeriodRange("90", 1_000_000)).toMatchObject({ id: "90", trendDays: 90, evidenceDays: 90 });
  });

  it("gives admin and executive company BI while keeping finance explicit", () => {
    const adminScope = biScopeForSession({ role: "admin" }, data);
    const executiveScope = biScopeForSession({ role: "executive" }, data);

    expect(adminScope.kind).toBe("company");
    expect(executiveScope.kind).toBe("company");
    expect(executiveScope.canViewCompanyBI).toBe(true);
    expect(executiveScope.canViewFinancialBI).toBe(true);
    expect(executiveScope.tickets.map((ticket) => ticket.id)).toEqual(["t-fac-a", "t-fac-b", "t-fleet-a", "t-fleet-b"]);
    expect(executiveScope.fleet.map((unit) => unit.id)).toEqual(["f-a", "f-b"]);
    expect(executiveScope.rounds.map((round) => round.id)).toEqual(["r-a", "r-shared", "r-b", "r-manual"]);
    expect(executiveScope.complaints.map((complaint) => complaint.id)).toEqual(["c-a", "c-shared", "c-b", "c-manual"]);
    expect(executiveScope.ppeItems.map((item) => item.id)).toEqual(["item-a", "item-req-a", "item-b"]);
    expect(executiveScope.ppeReqs.map((request) => request.id)).toEqual(["req-a", "req-b"]);
    expect(executiveScope.ppeOrders.map((order) => order.id)).toEqual(["ord-a", "ord-b"]);
    expect(executiveScope.users.map((user) => user.id)).toEqual(["u-a", "u-b", "admin"]);
    expect(executiveScope.tasks.map((task) => task.id)).toEqual(["task-a", "task-manager-a", "task-b", "task-admin"]);
    expect(executiveScope.meetings.map((meeting) => meeting.id)).toEqual(["meeting-a", "meeting-manager-a", "meeting-b", "meeting-admin"]);
  });

  it("limits department managers to their departments and shared zones", () => {
    const scope = biScopeForSession({ id: "manager-a", role: "user", depts: ["A"], mgrZones: ["z-manual"] }, data);

    expect(scope.kind).toBe("department");
    expect(scope.canViewCompanyBI).toBe(false);
    expect(scope.canViewFinancialBI).toBe(false);
    expect(scope.departments).toEqual(["A"]);
    expect(scope.tickets.map((ticket) => ticket.id)).toEqual(["t-fac-a", "t-fleet-a"]);
    expect(scope.fleet.map((unit) => unit.id)).toEqual(["f-a"]);
    expect(scope.pm.map((record) => record.id)).toEqual(["pm-a", "pm-a-alt"]);
    expect(scope.ppe.map((item) => item.id)).toEqual(["ppe-a", "ppe-a-item"]);
    expect(scope.ppeItems.map((item) => item.id)).toEqual(["item-a", "item-req-a"]);
    expect(scope.ppeReqs.map((request) => request.id)).toEqual(["req-a"]);
    expect(scope.ppeOrders).toEqual([]);
    expect(scope.users.map((user) => user.id)).toEqual(["u-a"]);
    expect(scope.zones.map((zone) => zone.id)).toEqual(["z-a", "z-shared", "z-fac-a"]);
    expect(scope.rounds.map((round) => round.id)).toEqual(["r-a", "r-shared", "r-manual"]);
    expect(scope.complaints.map((complaint) => complaint.id)).toEqual(["c-a", "c-shared", "c-manual"]);
    expect(scope.tasks.map((task) => task.id)).toEqual(["task-a", "task-manager-a"]);
    expect(scope.meetings.map((meeting) => meeting.id)).toEqual(["meeting-a", "meeting-manager-a"]);
    expect(scope.zoneIds).toEqual(["z-manual", "z-a", "z-shared", "z-fac-a"]);
  });

  it("supports production session department fields for department managers", () => {
    const scope = biScopeForSession({ id: "manager-a", role: "user", department: "A", departments: ["A"], mgrZones: ["z-manual"] }, data);

    expect(scope.kind).toBe("department");
    expect(scope.departments).toEqual(["A"]);
    expect(scope.tickets.map((ticket) => ticket.id)).toEqual(["t-fac-a", "t-fleet-a"]);
    expect(scope.fleet.map((unit) => unit.id)).toEqual(["f-a"]);
    expect(scope.rounds.map((round) => round.id)).toEqual(["r-a", "r-shared", "r-manual"]);
    expect(scope.complaints.map((complaint) => complaint.id)).toEqual(["c-a", "c-shared", "c-manual"]);
  });

  it("includes department facility tickets tied to scoped zones even without reporter department", () => {
    const scope = biScopeForSession({ role: "user", depts: ["A"] }, {
      ...data,
      tickets: [
        { id: "zone-ticket", track: "facility", zone: "Boiler Room" },
        { id: "other-zone-ticket", track: "facility", zone: "z-b" },
        { id: "transport-ticket", forkliftId: "f-a" }
      ]
    });

    expect(scope.tickets.map((ticket) => ticket.id)).toEqual(["zone-ticket", "transport-ticket"]);
  });

  it("does not promote a department manager without departments to company scope", () => {
    const scope = biScopeForSession({ role: "user", perms: { analytics: "view" } }, data);

    expect(scope.kind).toBe("department");
    expect(scope.departments).toEqual([]);
    expect(scope.canViewCompanyBI).toBe(false);
    expect(scope.canViewFinancialBI).toBe(false);
    expect(scope.tickets).toEqual([]);
    expect(scope.fleet).toEqual([]);
    expect(scope.rounds).toEqual([]);
    expect(scope.complaints).toEqual([]);
    expect(scope.ppe).toEqual([]);
    expect(scope.ppeItems).toEqual([]);
    expect(scope.ppeReqs).toEqual([]);
    expect(scope.ppeOrders).toEqual([]);
    expect(scope.users).toEqual([]);
    expect(scope.tasks).toEqual([]);
    expect(scope.meetings).toEqual([]);
  });

  it("does not expose BI scopes to operational roles in the first rollout", () => {
    expect(biScopeForSession({ role: "tech" }, data).kind).toBe("none");
    expect(biScopeForSession({ role: "worker" }, data).kind).toBe("none");
    expect(biScopeForSession(null, data).kind).toBe("none");
  });

  it("summarizes department risk without mixing unrelated departments", () => {
    const rows = biDepartmentRiskRows({
      departments: ["A", "B"],
      tickets: [
        { id: "open-a", track: "facility", status: "new", reportedBy: { dept: "A" } },
        { id: "closed-a", track: "facility", status: "closed", reportedBy: { dept: "A" } },
        { id: "fleet-b", status: "waiting", forkliftId: "f-b", downtimeType: "critical" }
      ],
      fleet: data.fleet,
      pm: [{ id: "pm-b", forkliftId: "f-b", late: true }],
      zones: [{ id: "z-a", dept: "A" }],
      complaints: [{ id: "clean-a", zoneId: "z-a", status: "pending" }],
      ppeReqs: [{ id: "ppe-b", dept: "B", status: "pending" }]
    }, {
      isOverdueTicket: (ticket) => ticket.id === "fleet-b",
      pmIsOverdue: (record) => record.late
    });

    expect(rows.map((row) => row.name)).toEqual(["B", "A"]);
    expect(rows.find((row) => row.name === "A")).toMatchObject({
      openTickets: 1,
      cleaningOpen: 1,
      criticalDowntime: 0,
      ppePending: 0
    });
    expect(rows.find((row) => row.name === "B")).toMatchObject({
      openTickets: 1,
      slaBreaches: 1,
      criticalDowntime: 1,
      pmOverdue: 1,
      ppePending: 1
    });
  });
});
