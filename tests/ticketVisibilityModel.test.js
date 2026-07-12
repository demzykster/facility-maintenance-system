import { describe, expect, it } from "vitest";
import { visibleTicketsForSession } from "../src/ticketVisibilityModel.js";

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

  it("does not give manager-wide visibility when no department or zone is configured", () => {
    const manager = { id: "manager-a", role: "user", name: "Manager A", depts: [], mgrZones: [] };

    expect(visibleTicketsForSession(manager, tickets, fleet).map((ticket) => ticket.id)).toEqual(["own"]);
  });

  it("keeps company-wide visibility explicit for admin and executive roles", () => {
    expect(visibleTicketsForSession({ role: "admin" }, tickets, fleet)).toEqual(tickets);
    expect(visibleTicketsForSession({ role: "executive" }, tickets, fleet)).toEqual(tickets);
  });
});
