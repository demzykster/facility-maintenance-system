import { describe, expect, it } from "vitest";
import { biScopeForSession } from "../src/biScopeModel.js";

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
    { id: "pm-b", fleetId: "f-b" }
  ],
  zones: [
    { id: "z-a", dept: "A" },
    { id: "z-shared", shared: true },
    { id: "z-b", dept: "B" }
  ],
  ppe: [
    { id: "ppe-a", dept: "A" },
    { id: "ppe-b", dept: "B" }
  ],
  users: [
    { id: "u-a", role: "worker", dept: "A" },
    { id: "u-b", role: "worker", depts: ["B"] },
    { id: "admin", role: "admin" }
  ]
};

describe("BI scope model", () => {
  it("gives admin and executive company BI while keeping finance explicit", () => {
    const adminScope = biScopeForSession({ role: "admin" }, data);
    const executiveScope = biScopeForSession({ role: "executive" }, data);

    expect(adminScope.kind).toBe("company");
    expect(executiveScope.kind).toBe("company");
    expect(executiveScope.canViewCompanyBI).toBe(true);
    expect(executiveScope.canViewFinancialBI).toBe(true);
    expect(executiveScope.tickets.map((ticket) => ticket.id)).toEqual(["t-fac-a", "t-fac-b", "t-fleet-a", "t-fleet-b"]);
    expect(executiveScope.fleet.map((unit) => unit.id)).toEqual(["f-a", "f-b"]);
    expect(executiveScope.users.map((user) => user.id)).toEqual(["u-a", "u-b", "admin"]);
  });

  it("limits department managers to their departments and shared zones", () => {
    const scope = biScopeForSession({ role: "user", depts: ["A"], mgrZones: ["z-manual"] }, data);

    expect(scope.kind).toBe("department");
    expect(scope.canViewCompanyBI).toBe(false);
    expect(scope.canViewFinancialBI).toBe(false);
    expect(scope.departments).toEqual(["A"]);
    expect(scope.tickets.map((ticket) => ticket.id)).toEqual(["t-fac-a", "t-fleet-a"]);
    expect(scope.fleet.map((unit) => unit.id)).toEqual(["f-a"]);
    expect(scope.pm.map((record) => record.id)).toEqual(["pm-a"]);
    expect(scope.ppe.map((item) => item.id)).toEqual(["ppe-a"]);
    expect(scope.users.map((user) => user.id)).toEqual(["u-a"]);
    expect(scope.zones.map((zone) => zone.id)).toEqual(["z-a", "z-shared"]);
    expect(scope.zoneIds).toEqual(["z-manual", "z-a", "z-shared"]);
  });

  it("does not promote a department manager without departments to company scope", () => {
    const scope = biScopeForSession({ role: "user", perms: { analytics: "view" } }, data);

    expect(scope.kind).toBe("department");
    expect(scope.departments).toEqual([]);
    expect(scope.canViewCompanyBI).toBe(false);
    expect(scope.canViewFinancialBI).toBe(false);
    expect(scope.tickets).toEqual([]);
    expect(scope.fleet).toEqual([]);
    expect(scope.users).toEqual([]);
  });

  it("does not expose BI scopes to operational roles in the first rollout", () => {
    expect(biScopeForSession({ role: "tech" }, data).kind).toBe("none");
    expect(biScopeForSession({ role: "worker" }, data).kind).toBe("none");
    expect(biScopeForSession(null, data).kind).toBe("none");
  });
});
