import {
  ticketTrack,
  transportTechnicianAssignee,
  transportTicketSupplierName
} from "../../src/ticketResponsibilityModel.js";
import { getTicketWaitingTargetState } from "../../src/ticketWaitingTargetModel.js";

const clean = (value) => String(value ?? "").trim();

const TERMINAL_STATUS = new Set(["done", "cancelled"]);
const TECHNICAL_RETURN_STATUSES = new Set(["rework", "pending_user", "pending_admin", "waiting"]);
const FACILITY_ADMIN_DIRECT_CLOSE_STATUSES = new Set(["new", "in_progress", "waiting"]);

const ALLOWED_TRANSITIONS = Object.freeze({
  pending_manager: Object.freeze(["new", "rework", "cancelled"]),
  rework: Object.freeze(["pending_manager", "in_progress", "cancelled"]),
  new: Object.freeze(["in_progress", "waiting", "cancelled"]),
  in_progress: Object.freeze(["waiting", "pending_user", "pending_admin", "cancelled"]),
  waiting: Object.freeze(["in_progress", "pending_user", "pending_admin", "cancelled"]),
  pending_user: Object.freeze(["pending_admin", "in_progress"]),
  pending_admin: Object.freeze(["done", "in_progress"]),
  done: Object.freeze([]),
  cancelled: Object.freeze([])
});

function statusOf(ticket = {}) {
  const status = clean(ticket.status) || "new";
  return status === "open" ? "new" : status;
}

function roleOf(session = {}) {
  return clean(session.role);
}

function identityMatches(value, actor = {}) {
  const id = clean(actor.id);
  const name = clean(actor.name);
  const candidate = clean(value);
  return !!candidate && (candidate === id || candidate === name);
}

function actorDepartments(actor = {}) {
  return [...new Set([
    ...(Array.isArray(actor.depts) ? actor.depts : []),
    ...(Array.isArray(actor.departments) ? actor.departments : []),
    actor.dept,
    actor.department
  ].map(clean).filter(Boolean))];
}

function fleetUnit(ticket = {}, fleet = []) {
  const id = clean(ticket.forkliftId || ticket.assetId || ticket.fleetId);
  return id ? (fleet || []).find((unit) => clean(unit?.id) === id) : null;
}

function fleetDepartments(unit = {}) {
  return [...new Set([
    ...(Array.isArray(unit?.depts) ? unit.depts : []),
    ...(Array.isArray(unit?.departments) ? unit.departments : []),
    unit?.dept,
    unit?.department
  ].map(clean).filter(Boolean))];
}

function ticketApprovalDepartments(ticket = {}, fleet = []) {
  return [...new Set([
    ticket.createdBy?.dept,
    ticket.createdBy?.department,
    ticket.reportedBy?.dept,
    ticket.reportedBy?.department,
    ticket.dept,
    ticket.department,
    ...fleetDepartments(fleetUnit(ticket, fleet))
  ].map(clean).filter(Boolean))];
}

function isTransportTicket(ticket = {}) {
  return ticketTrack(ticket) === "transport";
}

function transitionKey(previousTicket = {}, nextTicket = {}) {
  return `${statusOf(previousTicket)}:${statusOf(nextTicket)}`;
}

function actorCanHandleTransport(actor = {}) {
  const scope = clean(actor.techScope) || "transport";
  return scope === "transport" || scope === "both";
}

function assigneeName(ticket = {}) {
  return clean(ticket.assignee || ticket.assigneeName);
}

function assigneeMatchesActor(ticket = {}, actor = {}) {
  return identityMatches(ticket.assigneeId, actor) || identityMatches(ticket.assignee_id, actor) || identityMatches(assigneeName(ticket), actor);
}

function transportRoutingError(actor = {}, previousTicket = {}, nextTicket = {}, { fleet = [] } = {}) {
  if (!isTransportTicket(nextTicket) || transitionKey(previousTicket, nextTicket) !== "new:in_progress") return null;

  if (roleOf(actor) !== "tech" || !actorCanHandleTransport(actor)) return "transport_acceptance_actor_forbidden";

  const assetId = clean(nextTicket.forkliftId || nextTicket.assetId || nextTicket.fleetId);
  const supplier = transportTicketSupplierName(nextTicket, fleet);
  if (!assetId || !supplier || !assigneeName(nextTicket)) return "ticket_transition_required_fields_missing:transport_acceptance";
  if (clean(actor.supplier) !== supplier) return "transport_acceptance_supplier_mismatch";
  if (!assigneeMatchesActor(nextTicket, actor)) return "transport_acceptance_assignee_mismatch";
  return null;
}

function transportPreAcceptanceWaitingError(actor = {}, previousTicket = {}, nextTicket = {}, { fleet = [] } = {}) {
  if (!isTransportTicket(nextTicket) || transitionKey(previousTicket, nextTicket) !== "new:waiting") return null;
  if (clean(nextTicket.waitingReason) !== "no_equipment") return "transport_pre_acceptance_waiting_reason_forbidden";
  if (roleOf(actor) !== "tech" || !actorCanHandleTransport(actor)) return "transport_acceptance_actor_forbidden";

  const assetId = clean(nextTicket.forkliftId || nextTicket.assetId || nextTicket.fleetId);
  const supplier = transportTicketSupplierName(nextTicket, fleet);
  if (!assetId || !supplier || !assigneeName(nextTicket)) return "ticket_transition_required_fields_missing:transport_acceptance";
  if (clean(actor.supplier) !== supplier) return "transport_acceptance_supplier_mismatch";
  if (!assigneeMatchesActor(nextTicket, actor)) return "transport_acceptance_assignee_mismatch";
  return null;
}

function technicalReturnError(actor = {}, previousTicket = {}, nextTicket = {}, { fleet = [] } = {}) {
  const from = statusOf(previousTicket);
  const to = statusOf(nextTicket);
  if (!isTransportTicket(previousTicket) || to !== "in_progress" || !TECHNICAL_RETURN_STATUSES.has(from)) return null;

  const previousTechnician = transportTechnicianAssignee(previousTicket, fleet);
  if (!previousTechnician) return null;
  if (assigneeName(nextTicket) !== previousTechnician) return "ticket_rework_assignee_change_forbidden";
  if (roleOf(actor) === "tech" && !identityMatches(previousTechnician, actor)) return "ticket_transition_assignee_forbidden";
  if (from === "waiting" && roleOf(actor) !== "tech") return "ticket_transition_assignee_forbidden";
  return null;
}

function technicianCompletionError(actor = {}, previousTicket = {}, nextTicket = {}, { fleet = [] } = {}) {
  if (!isTransportTicket(previousTicket) || !["in_progress:pending_user", "waiting:pending_user"].includes(transitionKey(previousTicket, nextTicket))) return null;
  const previousTechnician = transportTechnicianAssignee(previousTicket, fleet);
  if (!previousTechnician || roleOf(actor) !== "tech" || !identityMatches(previousTechnician, actor)) return "ticket_transition_assignee_forbidden";
  if (assigneeName(nextTicket) !== previousTechnician) return "ticket_rework_assignee_change_forbidden";
  return null;
}

function technicianCancellationError(actor = {}, previousTicket = {}, nextTicket = {}) {
  if (roleOf(actor) !== "tech") return null;
  if (["in_progress:cancelled", "waiting:cancelled"].includes(transitionKey(previousTicket, nextTicket))) {
    return "ticket_transition_technician_cancel_forbidden";
  }
  return null;
}

function managerOwnsApproval(actor = {}, ticket = {}, { fleet = [] } = {}) {
  if (roleOf(actor) !== "user") return false;
  const creator = ticket.createdBy || {};
  if (clean(creator.role) === "user") {
    return identityMatches(creator.id, actor) || identityMatches(creator.name, actor);
  }
  const departments = ticketApprovalDepartments(ticket, fleet);
  if (!departments.length) return false;
  return actorDepartments(actor).some((department) => departments.includes(department));
}

function pendingAdminTransitionError(actor = {}, previousTicket = {}, nextTicket = {}, { fleet = [] } = {}) {
  if (statusOf(nextTicket) !== "pending_admin") return null;
  const key = transitionKey(previousTicket, nextTicket);

  if (key === "pending_user:pending_admin") {
    if (roleOf(actor) === "admin") return "ticket_admin_shortcut_forbidden";
    return managerOwnsApproval(actor, previousTicket, { fleet }) ? null : "ticket_transition_manager_ownership_forbidden";
  }

  if (roleOf(actor) === "admin") return "ticket_admin_shortcut_forbidden";

  const facilityManagerFinish = ticketTrack(previousTicket) === "facility"
    && ["in_progress:pending_admin", "waiting:pending_admin"].includes(key)
    && roleOf(actor) === "user"
    && nextTicket.mgrExec === true
    && assigneeMatchesActor(nextTicket, actor);
  return facilityManagerFinish ? null : "ticket_transition_required_fields_missing:manager_approval";
}

function isFacilityAdminDirectClose(actor = {}, previousTicket = {}, nextTicket = {}) {
  return ticketTrack(previousTicket) === "facility"
    && statusOf(nextTicket) === "done"
    && FACILITY_ADMIN_DIRECT_CLOSE_STATUSES.has(statusOf(previousTicket))
    && roleOf(actor) === "admin";
}

function doneTransitionError(actor = {}, previousTicket = {}, nextTicket = {}) {
  if (statusOf(nextTicket) !== "done") return null;
  const key = transitionKey(previousTicket, nextTicket);
  if (key !== "pending_admin:done" && !isFacilityAdminDirectClose(actor, previousTicket, nextTicket)) return null;
  const closure = nextTicket.closure || {};
  if (!clean(nextTicket.closedAt || closure.signedAt) || !clean(closure.signedBy) || !clean(closure.quality)) {
    return "ticket_transition_required_fields_missing:closure";
  }
  return null;
}

function waitingTransitionError(previousTicket = {}, nextTicket = {}) {
  if (statusOf(nextTicket) !== "waiting" || statusOf(previousTicket) === "waiting") return null;
  if (!clean(nextTicket.waitingReason)) return "ticket_transition_required_fields_missing:waitingReason";
  const targetState = getTicketWaitingTargetState(nextTicket);
  if (!targetState.satisfied) return "ticket_transition_required_fields_missing:waitingTarget";
  if (clean(nextTicket.waitingUntil) && targetState.requiredType !== "date") return "ticket_transition_required_fields_missing:waitingUntil";
  return null;
}

function statusChanged(previousTicket = {}, nextTicket = {}) {
  return statusOf(previousTicket) !== statusOf(nextTicket);
}

function allowedByMatrix(from, to) {
  if (from === to) return true;
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

function actorCanDriveTransition(actor = {}, previousTicket = {}, nextTicket = {}) {
  const role = roleOf(actor);
  const from = statusOf(previousTicket);
  const to = statusOf(nextTicket);
  if (role === "admin") return true;
  if (to === "done") return false;
  if (role === "worker") {
    return [
      "rework:pending_manager",
      "pending_manager:cancelled",
      "new:cancelled"
    ].includes(`${from}:${to}`);
  }
  if (role === "tech") {
    return [
      "new:in_progress",
      "new:waiting",
      "in_progress:waiting",
      "waiting:in_progress",
      "in_progress:pending_user",
      "waiting:pending_user",
      "in_progress:cancelled",
      "waiting:cancelled",
      "rework:in_progress"
    ].includes(`${from}:${to}`);
  }
  if (role === "user") {
    return [
      "pending_manager:new",
      "pending_manager:rework",
      "pending_manager:cancelled",
      "new:in_progress",
      "new:waiting",
      "new:cancelled",
      "in_progress:waiting",
      "waiting:in_progress",
      "in_progress:pending_user",
      "waiting:pending_user",
      "in_progress:pending_admin",
      "waiting:pending_admin",
      "pending_user:pending_admin",
      "pending_user:in_progress",
      "pending_admin:in_progress",
      "rework:in_progress"
    ].includes(`${from}:${to}`);
  }
  return false;
}

export function ticketLifecycleTransitionError(actor = {}, previousTicket = {}, nextTicket = {}, options = {}) {
  if (!statusChanged(previousTicket, nextTicket)) return null;
  const from = statusOf(previousTicket);
  const to = statusOf(nextTicket);
  if (TERMINAL_STATUS.has(from)) return "ticket_transition_from_terminal_forbidden";
  const facilityAdminDirectClose = isFacilityAdminDirectClose(actor, previousTicket, nextTicket);
  if (!allowedByMatrix(from, to) && !facilityAdminDirectClose) return `ticket_transition_forbidden:${from}:${to}`;
  if (!actorCanDriveTransition(actor, previousTicket, nextTicket)) return `ticket_transition_role_forbidden:${roleOf(actor) || "unknown"}:${from}:${to}`;
  return transportRoutingError(actor, previousTicket, nextTicket, options)
    || transportPreAcceptanceWaitingError(actor, previousTicket, nextTicket, options)
    || technicalReturnError(actor, previousTicket, nextTicket, options)
    || technicianCompletionError(actor, previousTicket, nextTicket, options)
    || technicianCancellationError(actor, previousTicket, nextTicket)
    || pendingAdminTransitionError(actor, previousTicket, nextTicket, options)
    || doneTransitionError(actor, previousTicket, nextTicket)
    || waitingTransitionError(previousTicket, nextTicket)
    || null;
}
