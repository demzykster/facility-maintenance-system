const cleanStringList = (values = []) =>
  [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];

export const ticketUserDepartments = (user = {}) =>
  cleanStringList(user.depts?.length ? user.depts : (user.dept ? [user.dept] : []));

export const ticketFleetDepartments = (unit = {}) =>
  cleanStringList(unit?.depts?.length ? unit.depts : (unit?.dept ? [unit.dept] : []));

export const ticketTrack = (ticket = {}) => ticket.track || (ticket.forkliftId ? "transport" : "facility");

export const ownsTicketRecord = (session = {}, ticket = {}) =>
  ticket.createdBy?.id ? ticket.createdBy.id === session.id : ticket.createdBy?.name === session.name;

const ticketInManagerDepartments = (ticket = {}, departments = []) => {
  if (!departments.length) return false;
  return [ticket.reportedBy?.dept, ticket.createdBy?.dept, ticket.department, ticket.dept]
    .some((dept) => dept && departments.includes(dept));
};

const transportTicketInManagerDepartments = (ticket = {}, departments = [], fleet = []) => {
  if (!departments.length || ticketTrack(ticket) !== "transport") return false;
  const unit = (fleet || []).find((item) => item.id === ticket.forkliftId);
  return ticketFleetDepartments(unit).some((department) => departments.includes(department));
};

const visibleToTechnician = (session = {}, ticket = {}, fleet = []) => {
  const scope = session.techScope || "transport";
  const cats = session.techCats || [];
  const track = ticketTrack(ticket);
  const mineOrFree = ticket.assignee === session.name || !ticket.assignee;
  if (scope === "transport") {
    if (track !== "transport") return false;
    if (!mineOrFree) return false;
    if (session.supplier) {
      if (ticket.supplier) return ticket.supplier === session.supplier;
      if (ticket.forkliftId) {
        const unit = (fleet || []).find((item) => item.id === ticket.forkliftId);
        if (unit?.supplier && unit.supplier !== session.supplier) return false;
      }
    }
    return true;
  }
  if (track !== "facility") return false;
  if (session.supplier && ticket.supplier !== session.supplier) return false;
  if (!session.supplier && ticket.supplier) return false;
  if (cats.length && ticket.category && !cats.includes(ticket.category)) return false;
  if (ticket.assignee) return ticket.assignee === session.name;
  return !!ticket.routedTech;
};

const visibleToManager = (session = {}, ticket = {}, fleet = []) => {
  if (ownsTicketRecord(session, ticket)) return true;
  if (ticket.assignee === session.name) return true;

  const departments = ticketUserDepartments(session);
  const track = ticketTrack(ticket);
  if (track === "transport") {
    return transportTicketInManagerDepartments(ticket, departments, fleet);
  }

  return ticketInManagerDepartments(ticket, departments);
};

export function visibleTicketsForSession(session = {}, tickets = [], fleet = []) {
  if (session.role === "admin" || session.role === "executive") return tickets;
  if (session.role === "worker") return tickets.filter((ticket) => ticket.reportedBy && ticket.reportedBy.id === session.id);
  if (session.role === "tech") return tickets.filter((ticket) => visibleToTechnician(session, ticket, fleet));
  if (session.role === "user") return tickets.filter((ticket) => visibleToManager(session, ticket, fleet));
  return [];
}
