import { describe, expect, it } from "vitest";
import {
  canConfirmTicketForSession,
  managerActionRequiredForTicket,
  managerScopedTicketNeedsFollowUp
} from "../src/ticketActionScopeModel.js";

const context = { open: true, ball: "manager", workerReport: false };

describe("ticketActionScopeModel", () => {
  it("keeps opener approval personal even when another manager shares the department scope", () => {
    const opener = { id: "mgr-a", name: "A", role: "user", dept: "נפחי" };
    const colleague = { id: "mgr-b", name: "B", role: "user", dept: "נפחי" };
    const ticket = {
      id: "T-1",
      status: "pending_user",
      createdBy: { id: opener.id, name: opener.name, role: "user", dept: opener.dept }
    };

    expect(canConfirmTicketForSession(opener, ticket)).toBe(true);
    expect(managerActionRequiredForTicket(opener, ticket, context)).toBe(true);
    expect(managerScopedTicketNeedsFollowUp(opener, ticket, context)).toBe(false);

    expect(canConfirmTicketForSession(colleague, ticket)).toBe(false);
    expect(managerActionRequiredForTicket(colleague, ticket, context)).toBe(false);
    expect(managerScopedTicketNeedsFollowUp(colleague, ticket, context)).toBe(true);
  });

  it("keeps worker reports actionable for visible department managers", () => {
    const manager = { id: "mgr-a", name: "Manager", role: "user", dept: "נפחי" };
    const ticket = {
      id: "T-2",
      status: "pending_manager",
      reportedBy: { id: "worker-a", name: "Worker", dept: "נפחי" },
      createdBy: { id: "worker-a", name: "Worker", role: "worker", dept: "נפחי" }
    };
    const workerContext = { open: true, ball: "manager", workerReport: true };

    expect(managerActionRequiredForTicket(manager, ticket, workerContext)).toBe(true);
    expect(managerScopedTicketNeedsFollowUp(manager, ticket, workerContext)).toBe(false);
  });
});
