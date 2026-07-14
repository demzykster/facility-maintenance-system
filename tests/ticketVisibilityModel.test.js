import { describe, expect, it } from "vitest";
import { pmVisibleForSession, visibleFleetForSession, visibleTicketsForSession } from "../src/ticketVisibilityModel.js";

describe("ticket visibility model", () => {
  const tickets = [
    { id: "aircon", track: "facility", zone: "משרדים", category: "hvac", createdBy: { id: "creator-a", name: "Creator A", dept: "A" } },
    { id: "dock", track: "facility", zone: "רציפים", category: "electric", createdBy: { id: "creator-b", name: "Creator B", dept: "B" } },
    { id: "legacy-a", track: "facility", createdBy: { id: "creator-a", name: "Creator A", dept: "A" } },
    { id: "fleet-a", track: "transport", forkliftId: "fork-a" },
    { id: "own", track: "facility", zone: "הנהלה", createdBy: { id: "manager-a", name: "Manager A", dept: "A" } }
  ];

  const fleet = [
    { id: "fork-a", depts: ["A"] }
  ];

  it("lets managers share tickets through common departments, not common maintenance zones", () => {
    const managerA = { id: "manager-a", role: "user", name: "Manager A", depts: ["A"], mgrZones: ["משרדים"] };
    const managerPeer = { id: "manager-peer", role: "user", name: "Manager Peer", depts: ["C"], mgrZones: ["משרדים"] };
    const managerOtherZone = { id: "manager-other", role: "user", name: "Manager Other", depts: ["A"], mgrZones: ["רציפים"] };

    expect(visibleTicketsForSession(managerA, tickets, fleet).map((ticket) => ticket.id)).toEqual(["aircon", "legacy-a", "fleet-a", "own"]);
    expect(visibleTicketsForSession(managerPeer, tickets, fleet).map((ticket) => ticket.id)).toEqual([]);
    expect(visibleTicketsForSession(managerOtherZone, tickets, fleet).map((ticket) => ticket.id)).toEqual(["aircon", "legacy-a", "fleet-a", "own"]);
  });

  it("supports production session department fields for managers", () => {
    const manager = { id: "manager-a", role: "user", name: "Manager A", department: "A", departments: ["A"], mgrZones: ["משרדים"] };

    expect(visibleTicketsForSession(manager, tickets, fleet).map((ticket) => ticket.id)).toEqual(["aircon", "legacy-a", "fleet-a", "own"]);
  });

  it("does not give manager-wide visibility when no department or zone is configured", () => {
    const manager = { id: "manager-a", role: "user", name: "Manager A", depts: [], mgrZones: [] };

    expect(visibleTicketsForSession(manager, tickets, fleet).map((ticket) => ticket.id)).toEqual(["own"]);
  });

  it("keeps company-wide visibility explicit for admin and executive roles", () => {
    expect(visibleTicketsForSession({ role: "admin" }, tickets, fleet)).toEqual(tickets);
    expect(visibleTicketsForSession({ role: "executive" }, tickets, fleet)).toEqual(tickets);
  });

  it("lets technicians with both scope see transport and facility supplier queues", () => {
    const mixedTickets = [
      { id: "transport-linked", track: "transport", forkliftId: "fork-liftco", assignee: "", supplier: "LiftCo" },
      { id: "facility-linked", track: "facility", category: "hvac", assignee: "", routedTech: true, supplier: "LiftCo" },
      { id: "facility-other", track: "facility", category: "hvac", assignee: "", routedTech: true, supplier: "Other" }
    ];
    const mixedFleet = [{ id: "fork-liftco", supplier: "LiftCo" }];

    expect(visibleTicketsForSession({
      role: "tech",
      name: "Tech",
      techScope: "both",
      supplier: "LiftCo"
    }, mixedTickets, mixedFleet).map((ticket) => ticket.id)).toEqual(["transport-linked", "facility-linked"]);
  });

  it("keeps supplier facility tickets visible to matching supplier technicians before acceptance", () => {
    const supplierTicket = { id: "facility-linked", track: "facility", category: "hvac", assignee: "", routedTech: true, supplier: "LiftCo" };

    expect(visibleTicketsForSession({
      role: "tech",
      name: "Tech",
      techScope: "facility",
      supplier: "LiftCo"
    }, [supplierTicket], []).map((ticket) => ticket.id)).toEqual(["facility-linked"]);
  });

  it("limits transport choices to the actor departments", () => {
    const fleetList = [
      { id: "fork-a", depts: ["A"] },
      { id: "fork-b", department: "B" },
      { id: "fork-none" }
    ];

    expect(visibleFleetForSession({ role: "user", depts: ["A"] }, fleetList).map((unit) => unit.id)).toEqual(["fork-a"]);
    expect(visibleFleetForSession({ role: "user", department: "B" }, fleetList).map((unit) => unit.id)).toEqual(["fork-b"]);
    expect(visibleFleetForSession({ role: "tech", supplier: "LiftCo" }, [
      { id: "liftco-a", supplier: "LiftCo" },
      { id: "other-a", supplier: "Other" }
    ]).map((unit) => unit.id)).toEqual(["liftco-a"]);
    expect(visibleFleetForSession({ role: "user" }, fleetList)).toEqual([]);
    expect(visibleFleetForSession({ role: "admin" }, fleetList)).toEqual(fleetList);
    expect(visibleFleetForSession({ role: "executive" }, fleetList)).toEqual(fleetList);
  });

  it("keeps PM schedules visible to managers only through their fleet departments", () => {
    const pm = [
      { id: "pm-a", forkliftId: "fork-a", active: true },
      { id: "pm-b", forkliftId: "fork-b", active: true },
      { id: "pm-inactive", forkliftId: "fork-a", active: false }
    ];
    const fleetList = [
      { id: "fork-a", departments: ["A"] },
      { id: "fork-b", departments: ["B"] }
    ];

    expect(pmVisibleForSession({ role: "user", departments: ["A"] }, pm, fleetList).map((task) => task.id)).toEqual(["pm-a"]);
    expect(pmVisibleForSession({ role: "user" }, pm, fleetList).map((task) => task.id)).toEqual(["pm-a", "pm-b"]);
  });

  it("keeps supplier technicians scoped to PM schedules for their supplier fleet", () => {
    const pm = [
      { id: "pm-liftco", forkliftId: "fork-liftco", active: true },
      { id: "pm-other", forkliftId: "fork-other", active: true }
    ];
    const fleetList = [
      { id: "fork-liftco", supplier: "LiftCo" },
      { id: "fork-other", supplier: "Other" }
    ];

    expect(pmVisibleForSession({ role: "tech", supplier: "LiftCo" }, pm, fleetList).map((task) => task.id)).toEqual(["pm-liftco"]);
  });
});
