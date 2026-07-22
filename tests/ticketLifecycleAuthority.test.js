import { describe, expect, it } from "vitest";
import { ticketLifecycleTransitionError } from "../server/tickets/ticketLifecycleAuthority.js";

describe("server ticket lifecycle authority", () => {
  const fleet = [{ id: "fork-ops", supplier: "Toyota", depts: ["Ops"] }];

  it("allows admin final close from pending admin with closure fields", () => {
    expect(ticketLifecycleTransitionError(
      { role: "admin" },
      { status: "pending_admin" },
      { status: "done", closedAt: 3_000, closure: { signedBy: "Admin", signedAt: 3_000, quality: "resolved" } }
    )).toBeNull();

    expect(ticketLifecycleTransitionError(
      { role: "admin" },
      { status: "new", track: "transport", forkliftId: "fork-ops", supplier: "Toyota" },
      { status: "done", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", closedAt: 3_000, closure: { signedBy: "Admin", signedAt: 3_000, quality: "resolved" } },
      { fleet }
    )).toBe("ticket_transition_forbidden:new:done");
  });

  it("allows admin to close active facility tickets with closure fields", () => {
    for (const status of ["new", "in_progress", "waiting"]) {
      expect(ticketLifecycleTransitionError(
        { role: "admin", name: "Admin" },
        { status, track: "facility", category: "doors" },
        { status: "done", track: "facility", category: "doors", closedAt: 3_000, closure: { signedBy: "Admin", signedAt: 3_000, quality: "resolved" } }
      )).toBeNull();
    }
  });

  it("rejects direct facility admin close without closure fields", () => {
    expect(ticketLifecycleTransitionError(
      { role: "admin", name: "Admin" },
      { status: "in_progress", track: "facility", category: "doors" },
      { status: "done", track: "facility", category: "doors" }
    )).toBe("ticket_transition_required_fields_missing:closure");
  });

  it("rejects admin final close without the existing closure signature fields", () => {
    expect(ticketLifecycleTransitionError(
      { role: "admin" },
      { status: "pending_admin" },
      { status: "done" }
    )).toBe("ticket_transition_required_fields_missing:closure");
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
      { id: "manager-1", role: "user", name: "Manager", departments: ["Ops"] },
      { status: "pending_user", track: "transport", forkliftId: "fork-ops", assignee: "Sharon", supplier: "Toyota", createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } },
      { status: "in_progress", track: "transport", forkliftId: "fork-ops", assignee: "Sharon", supplier: "Toyota", returned: true },
      { fleet }
    )).toBeNull();
  });

  it("rejects transport rework when the assignee changes silently", () => {
    expect(ticketLifecycleTransitionError(
      { id: "manager-1", role: "user", name: "Manager", departments: ["Ops"] },
      { status: "pending_user", track: "transport", forkliftId: "fork-ops", assignee: "Sharon", supplier: "Toyota", createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } },
      { status: "in_progress", track: "transport", forkliftId: "fork-ops", assignee: "Dana", supplier: "Toyota", returned: true },
      { fleet }
    )).toBe("ticket_rework_assignee_change_forbidden");
  });

  it("requires transport supplier acceptance to be performed by the matching technician", () => {
    const previous = { status: "new", track: "transport", forkliftId: "fork-ops", assignee: "", supplier: "Toyota", routedTech: true };

    expect(ticketLifecycleTransitionError(
      { id: "tech-1", role: "tech", name: "Sharon", techScope: "transport", supplier: "Toyota" },
      previous,
      { ...previous, status: "in_progress", assignee: "Sharon" },
      { fleet }
    )).toBeNull();

    expect(ticketLifecycleTransitionError(
      { id: "manager-1", role: "user", name: "Manager", departments: ["Ops"] },
      previous,
      { ...previous, status: "in_progress", assignee: "Manager" },
      { fleet }
    )).toBe("transport_acceptance_actor_forbidden");

    expect(ticketLifecycleTransitionError(
      { id: "admin-1", role: "admin", name: "Admin" },
      previous,
      { ...previous, status: "in_progress", assignee: "Admin" },
      { fleet }
    )).toBe("transport_acceptance_actor_forbidden");

    expect(ticketLifecycleTransitionError(
      { id: "tech-2", role: "tech", name: "Dana", techScope: "transport", supplier: "Other" },
      previous,
      { ...previous, status: "in_progress", assignee: "Dana" },
      { fleet }
    )).toBe("transport_acceptance_supplier_mismatch");

    expect(ticketLifecycleTransitionError(
      { id: "tech-1", role: "tech", name: "Sharon", techScope: "transport", supplier: "Toyota" },
      previous,
      { ...previous, status: "in_progress", assignee: "Dana" },
      { fleet }
    )).toBe("transport_acceptance_assignee_mismatch");
  });

  it("allows a matching transport technician to report that the tool was not received before acceptance", () => {
    const previous = { status: "new", track: "transport", forkliftId: "fork-ops", assignee: "", supplier: "Toyota", routedTech: true };
    const next = { ...previous, status: "waiting", waitingReason: "no_equipment", waitBall: "manager", assignee: "Sharon", equipWaitSince: 3_000 };

    expect(ticketLifecycleTransitionError(
      { id: "tech-1", role: "tech", name: "Sharon", techScope: "transport", supplier: "Toyota" },
      previous,
      next,
      { fleet }
    )).toBeNull();

    expect(ticketLifecycleTransitionError(
      { id: "tech-2", role: "tech", name: "Dana", techScope: "transport", supplier: "Toyota" },
      previous,
      next,
      { fleet }
    )).toBe("transport_acceptance_assignee_mismatch");

    expect(ticketLifecycleTransitionError(
      { id: "tech-1", role: "tech", name: "Sharon", techScope: "transport", supplier: "Other" },
      previous,
      next,
      { fleet }
    )).toBe("transport_acceptance_supplier_mismatch");
  });

  it("does not let technicians put unaccepted transport tickets into arbitrary waiting reasons", () => {
    const previous = { status: "new", track: "transport", forkliftId: "fork-ops", assignee: "", supplier: "Toyota", routedTech: true };

    expect(ticketLifecycleTransitionError(
      { id: "tech-1", role: "tech", name: "Sharon", techScope: "transport", supplier: "Toyota" },
      previous,
      { ...previous, status: "waiting", waitingReason: "parts", waitBall: "executor", assignee: "Sharon" },
      { fleet }
    )).toBe("transport_pre_acceptance_waiting_reason_forbidden");
  });

  it("blocks technician cancellation of active transport work", () => {
    expect(ticketLifecycleTransitionError(
      { role: "tech", name: "Sharon", techScope: "transport", supplier: "Toyota" },
      { status: "in_progress", track: "transport", forkliftId: "fork-ops", assignee: "Sharon", supplier: "Toyota" },
      { status: "cancelled", track: "transport", forkliftId: "fork-ops", assignee: "Sharon", supplier: "Toyota" },
      { fleet }
    )).toBe("ticket_transition_technician_cancel_forbidden");
  });

  it("requires the actual manager owner for manager approval", () => {
    const previous = { status: "pending_user", track: "transport", forkliftId: "fork-ops", assignee: "Sharon", supplier: "Toyota", createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } };

    expect(ticketLifecycleTransitionError(
      { id: "manager-1", role: "user", name: "Manager", departments: ["Ops"] },
      previous,
      { ...previous, status: "pending_admin" },
      { fleet }
    )).toBeNull();

    expect(ticketLifecycleTransitionError(
      { id: "manager-2", role: "user", name: "Other Manager", departments: ["Ops"] },
      previous,
      { ...previous, status: "pending_admin" },
      { fleet }
    )).toBe("ticket_transition_manager_ownership_forbidden");

    expect(ticketLifecycleTransitionError(
      { id: "admin-1", role: "admin", name: "Admin" },
      previous,
      { ...previous, status: "pending_admin" },
      { fleet }
    )).toBe("ticket_admin_shortcut_forbidden");
  });

  it("blocks admin shortcuts from active work directly to pending admin", () => {
    expect(ticketLifecycleTransitionError(
      { id: "admin-1", role: "admin", name: "Admin" },
      { status: "in_progress", track: "transport", forkliftId: "fork-ops", assignee: "Sharon", supplier: "Toyota", createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } },
      { status: "pending_admin", track: "transport", forkliftId: "fork-ops", assignee: "Sharon", supplier: "Toyota" },
      { fleet }
    )).toBe("ticket_admin_shortcut_forbidden");
  });

  it("allows the department manager to approve worker-created tickets without first-match guessing", () => {
    const previous = { status: "pending_user", track: "transport", forkliftId: "fork-ops", assignee: "Sharon", supplier: "Toyota", createdBy: { id: "worker-1", name: "Worker", role: "worker", dept: "Ops" } };

    expect(ticketLifecycleTransitionError(
      { id: "manager-1", role: "user", name: "Manager", departments: ["Ops"] },
      previous,
      { ...previous, status: "pending_admin" },
      { fleet }
    )).toBeNull();

    expect(ticketLifecycleTransitionError(
      { id: "manager-2", role: "user", name: "Other Manager", departments: ["Other"] },
      previous,
      { ...previous, status: "pending_admin" },
      { fleet }
    )).toBe("ticket_transition_manager_ownership_forbidden");
  });

  it("fails closed when manager ownership cannot be derived", () => {
    expect(ticketLifecycleTransitionError(
      { id: "manager-1", role: "user", name: "Manager", departments: ["Ops"] },
      { status: "pending_user", track: "transport", assignee: "Sharon", supplier: "Toyota", createdBy: { id: "worker-1", name: "Worker", role: "worker" } },
      { status: "pending_admin", track: "transport", assignee: "Sharon", supplier: "Toyota" },
      { fleet: [] }
    )).toBe("ticket_transition_manager_ownership_forbidden");
  });

  it("keeps facility manager execution outside the transport acceptance guard", () => {
    expect(ticketLifecycleTransitionError(
      { id: "manager-1", role: "user", name: "Manager", departments: ["Ops"] },
      { status: "new", track: "facility", assignee: "Manager", mgrExec: true, createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } },
      { status: "in_progress", track: "facility", assignee: "Manager", mgrExec: true }
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
