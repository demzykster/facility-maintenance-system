import { ownsTicketRecord } from "./ticketVisibilityModel.js";

export const requesterOwnsTicket = (session = {}, ticket = {}) =>
  ownsTicketRecord(session, ticket) ||
  (ticket.reportedBy?.id ? ticket.reportedBy.id === session.id : ticket.reportedBy?.name === session.name);

export const canConfirmTicketForSession = (session = {}, ticket = {}) => {
  if (session.role === "admin") return true;
  return session.role === "user" && requesterOwnsTicket(session, ticket);
};

export const managerActionRequiredForTicket = (session = {}, ticket = {}, context = {}) => {
  if (context.open === false) return false;
  if (ticket.status === "pending_user") return canConfirmTicketForSession(session, ticket);
  if (context.ball === "manager") return true;
  if (context.workerReport && (ticket.status === "pending_manager" || ticket.status === "rework")) return true;
  return false;
};
