import { describe, expect, it } from "vitest";
import { ticketLifecycleTransitionError } from "../server/tickets/ticketLifecycleAuthority.js";

describe("server ticket lifecycle authority", () => {
  it("allows admin final close only from pending admin", () => {
    expect(ticketLifecycleTransitionError(
      { role: "admin" },
      { status: "pending_admin" },
      { status: "done" }
    )).toBeNull();

    expect(ticketLifecycleTransitionError(
      { role: "admin" },
      { status: "new" },
      { status: "done" }
    )).toBe("ticket_transition_forbidden:new:done");
  });

  it("keeps final closure admin-only", () => {
    expect(ticketLifecycleTransitionError(
      { role: "user" },
      { status: "pending_admin" },
      { status: "done" }
    )).toBe("ticket_transition_role_forbidden:user:pending_admin:done");
  });

  it("allows transport rework to return to the same technician path without supplier queue reset", () => {
    expect(ticketLifecycleTransitionError(
      { role: "user" },
      { status: "pending_user", track: "transport", assignee: "Sharon", supplier: "Toyota" },
      { status: "in_progress", track: "transport", assignee: "Sharon", supplier: "Toyota", returned: true }
    )).toBeNull();
  });

  it("allows workers to resubmit only their rework intake", () => {
    expect(ticketLifecycleTransitionError(
      { role: "worker" },
      { status: "rework" },
      { status: "pending_manager" }
    )).toBeNull();

    expect(ticketLifecycleTransitionError(
      { role: "worker" },
      { status: "pending_manager" },
      { status: "new" }
    )).toBe("ticket_transition_role_forbidden:worker:pending_manager:new");
  });
});
