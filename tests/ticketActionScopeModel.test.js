import { describe, expect, it } from "vitest";
import { canConfirmTicketForSession, managerActionRequiredForTicket, requesterOwnsTicket } from "../src/ticketActionScopeModel.js";

describe("ticket action scope model", () => {
  const ticket = {
    id: "facility-1",
    status: "pending_user",
    createdBy: { id: "manager-a", name: "Manager A", dept: "ops" }
  };

  it("keeps confirmation personal to the ticket creator, while admin can still intervene", () => {
    expect(canConfirmTicketForSession({ id: "manager-a", role: "user", name: "Manager A" }, ticket)).toBe(true);
    expect(canConfirmTicketForSession({ id: "manager-b", role: "user", name: "Manager B", depts: ["ops"] }, ticket)).toBe(false);
    expect(canConfirmTicketForSession({ id: "admin", role: "admin", name: "Admin" }, ticket)).toBe(true);
  });

  it("does not mark peer-visible pending_user tickets as manager action", () => {
    const creator = { id: "manager-a", role: "user", name: "Manager A" };
    const peer = { id: "manager-b", role: "user", name: "Manager B", depts: ["ops"] };

    expect(managerActionRequiredForTicket(creator, ticket, { open: true, ball: "manager" })).toBe(true);
    expect(managerActionRequiredForTicket(peer, ticket, { open: true, ball: "manager" })).toBe(false);
  });

  it("supports worker report ownership for requester checks", () => {
    const workerTicket = { id: "worker-1", reportedBy: { id: "worker-a", name: "Worker A" } };

    expect(requesterOwnsTicket({ id: "worker-a", name: "Worker A" }, workerTicket)).toBe(true);
    expect(requesterOwnsTicket({ id: "worker-b", name: "Worker B" }, workerTicket)).toBe(false);
  });
});
