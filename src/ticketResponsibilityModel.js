const text = (value) => String(value == null ? "" : value).trim();

export const ticketTrack = (ticket = {}) => ticket.track || (ticket.forkliftId ? "transport" : "facility");

export function transportTicketSupplierName(ticket = {}, fleet = []) {
  if (ticketTrack(ticket) !== "transport") return "";
  const linkedUnit = (fleet || []).find((unit) => unit?.id && unit.id === ticket.forkliftId);
  return text(linkedUnit?.supplier || ticket.supplier);
}

const requesterName = (ticket = {}) =>
  text(ticket.createdBy?.name || ticket.reportedBy?.name || ticket.requesterName || ticket.openedBy);

export function ticketResponsibleLabel(ticket = {}, { fleet = [] } = {}) {
  const assignee = text(ticket.assignee);
  if (ticketTrack(ticket) !== "transport") return assignee || text(ticket.supplier) || "טרם שויך";

  const supplier = transportTicketSupplierName(ticket, fleet);
  const technician = transportTechnicianAssignee(ticket, fleet);
  if (technician) return supplier ? `${supplier} · ${technician}` : technician;
  return supplier ? `${supplier} · טרם נלקח ע״י טכנאי` : "טרם נלקח ע״י טכנאי";
}

export function transportTechnicianAssignee(ticket = {}, fleet = []) {
  const assignee = text(ticket.assignee);
  if (ticketTrack(ticket) !== "transport" || !assignee) return assignee;
  const supplier = transportTicketSupplierName(ticket, fleet);
  if (supplier && assignee === supplier) return "";
  if (ticket.status === "new" && assignee === requesterName(ticket) && ticket.createdBy?.role !== "tech") return "";
  return assignee;
}

export function ticketHolderLabel(ticket = {}, holderKey = "", { fleet = [] } = {}) {
  if (holderKey === "tech") return ticketResponsibleLabel(ticket, { fleet });
  if (holderKey === "manager") {
    const name = requesterName(ticket);
    if (ticket.status === "waiting" && ticket.waitingReason === "no_equipment") {
      return name ? `${name} · להעביר כלי` : "מנהל מחלקה · להעביר כלי";
    }
    if (ticket.status === "pending_manager") return name ? `${name} · לאישור דיווח` : "מנהל מחלקה · לאישור דיווח";
    if (ticket.status === "pending_user") return name ? `${name} · לאישור ביצוע` : "פותח הקריאה · לאישור ביצוע";
    return name || "מנהל מחלקה";
  }
  if (holderKey === "admin") return "מנהל מערכת";
  return "";
}

export function normalizeTransportCreateResponsibility(ticket = {}, previousTicket = null) {
  if (previousTicket || ticketTrack(ticket) !== "transport" || ticket.status !== "new") return ticket;
  if (!transportTechnicianAssignee(ticket) && ticket.routedTech === true && !text(ticket.assignee)) return ticket;
  return { ...ticket, assignee: "", routedTech: true };
}
