import {
  ticketTrack,
  transportTechnicianAssignee
} from "./ticketResponsibilityModel.js";

const text = (value) => String(value == null ? "" : value).trim();

const requesterTarget = (ticket = {}) => {
  const id = text(ticket.createdBy?.id || ticket.reportedBy?.id || ticket.requesterId);
  const name = text(ticket.createdBy?.name || ticket.reportedBy?.name || ticket.requesterName || ticket.openedBy);
  return id || name ? { id, name } : null;
};

export function getTicketResponsibleUser(ticket = {}, { fleet = [] } = {}) {
  const track = ticketTrack(ticket);
  const name = track === "transport"
    ? transportTechnicianAssignee(ticket, fleet)
    : text(ticket.assignee);
  return {
    name,
    source: name ? "assignee" : "none",
    track
  };
}

export function getTicketAssignedSupplier(ticket = {}, { fleet = [] } = {}) {
  const track = ticketTrack(ticket);
  const linkedUnit = track === "transport" && ticket.forkliftId
    ? (fleet || []).find((unit) => unit?.id && unit.id === ticket.forkliftId)
    : null;
  const linkedSupplier = text(linkedUnit?.supplier);
  const ticketSupplier = text(ticket.supplier);
  const name = linkedSupplier || ticketSupplier;
  return {
    name,
    source: name ? (linkedSupplier ? "fleet" : "ticket") : "none",
    track,
    isWaitingTarget: false
  };
}

export function getTicketExecutionContext(ticket = {}, { fleet = [] } = {}) {
  const track = ticketTrack(ticket);
  const responsible = getTicketResponsibleUser(ticket, { fleet });
  const assignedSupplier = getTicketAssignedSupplier(ticket, { fleet });
  const routedTech = ticket.routedTech === true;
  const managerExecution = track === "facility" && ticket.mgrExec === true;
  let mode = "unassigned";

  if (responsible.name) mode = managerExecution ? "manager_execution" : "technician";
  else if (assignedSupplier.name && routedTech) mode = "supplier_queue";
  else if (routedTech) mode = "technician_pool";
  else if (track === "facility" && !ticket.returned) mode = "admin_triage";

  return {
    track,
    mode,
    responsibleUser: responsible.name,
    supplier: assignedSupplier.name,
    technician: responsible.name,
    routedTech,
    managerExecution
  };
}

export function getTicketWaitingContext(ticket = {}, {
  waitReasonMeta = () => ({})
} = {}) {
  if (ticket.status === "pending_user") {
    return {
      isWaiting: true,
      status: "pending_user",
      reason: "requester_confirmation",
      reasonSource: "status",
      actionOwner: "requester",
      pauseSla: false,
      hasExplicitTarget: true,
      targetType: "requester",
      target: requesterTarget(ticket)
    };
  }

  if (ticket.status !== "waiting") {
    return {
      isWaiting: false,
      status: ticket.status || "",
      reason: "",
      reasonSource: "none",
      actionOwner: "",
      pauseSla: false,
      hasExplicitTarget: false,
      targetType: "none",
      target: null
    };
  }

  const reason = text(ticket.waitingReason) || "other";
  const meta = waitReasonMeta(reason) || {};
  const actionOwner = text(ticket.waitBall || meta.ball || (reason === "no_equipment" ? "manager" : "executor"));
  return {
    isWaiting: true,
    status: "waiting",
    reason,
    reasonSource: "waitingReason",
    actionOwner,
    pauseSla: !!meta.pauseSla,
    hasExplicitTarget: false,
    targetType: "none",
    target: null
  };
}
