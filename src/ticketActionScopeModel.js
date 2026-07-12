import { ownsTicketRecord } from "./ticketVisibilityModel.js";

export const requesterOwnsTicket = (session = {}, ticket = {}) =>
  ownsTicketRecord(session, ticket) ||
  (ticket.reportedBy?.id ? ticket.reportedBy.id === session.id : ticket.reportedBy?.name === session.name);

export const canConfirmTicketForSession = (session = {}, ticket = {}) => {
  if (session.role === "admin") return true;
  return session.role === "user" && requesterOwnsTicket(session, ticket);
};

export const managerScopedTicketNeedsFollowUp = (session = {}, ticket = {}, context = {}) => {
  if (session.role !== "user" || context.open === false) return false;
  if (context.workerReport && (ticket.status === "pending_manager" || ticket.status === "rework")) return false;
  if (ticket.status === "pending_user") return !canConfirmTicketForSession(session, ticket);
  if (context.ball === "manager") return !requesterOwnsTicket(session, ticket) && ticket.assignee !== session.name;
  return false;
};

export const managerActionRequiredForTicket = (session = {}, ticket = {}, context = {}) => {
  if (context.open === false) return false;
  if (ticket.status === "pending_user") return canConfirmTicketForSession(session, ticket);
  if (context.workerReport && (ticket.status === "pending_manager" || ticket.status === "rework")) return true;
  if (context.ball === "manager") return requesterOwnsTicket(session, ticket) || ticket.assignee === session.name;
  return false;
};
