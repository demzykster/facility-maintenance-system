import { getTicketExecutionContext, getTicketWaitingContext } from "./ticketResponsibilitySemanticModel.js";
import { getTicketLifecycleContext } from "./ticketListSemanticModel.js";

const managerOwners = new Set(["manager", "requester", "user"]);

function executionOwnerKey(execution = {}) {
  if (execution.track === "facility" && execution.mode === "admin_triage") return "admin";
  if (execution.mode === "manager_execution") return "manager";
  if (execution.mode === "unassigned") return "none";
  return "tech";
}

export function ticketNextResponsibilityKey(ticket = {}, options = {}) {
  const lifecycle = getTicketLifecycleContext(ticket, options);
  if (lifecycle.stage === "closed" || lifecycle.stage === "rework") return "none";
  if (lifecycle.stage === "manager_approval") return "manager";
  if (lifecycle.stage === "admin_closure") return "admin";

  const execution = getTicketExecutionContext(ticket, options);
  if (lifecycle.stage === "waiting") {
    const waiting = getTicketWaitingContext(ticket, options);
    if (waiting.actionOwner === "admin") return "admin";
    if (managerOwners.has(waiting.actionOwner)) return "manager";
    return executionOwnerKey(execution);
  }

  return executionOwnerKey(execution);
}
