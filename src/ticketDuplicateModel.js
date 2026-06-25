export const ticketIsOpen = (ticket) => ticket?.status !== "done" && ticket?.status !== "cancelled";

const byRecent = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);

export function transportDuplicateReview(target, tickets, { closedLimit = 6 } = {}) {
  if (!target || target.track !== "transport" || !target.forkliftId) return { mode: "none", tickets: [] };

  const sameUnit = (tickets || [])
    .filter((ticket) => ticket?.id !== target.id && ticket.forkliftId === target.forkliftId);

  const open = sameUnit.filter(ticketIsOpen).sort(byRecent);
  if (open.length) return { mode: "open", tickets: open };

  const closed = sameUnit.filter((ticket) => !ticketIsOpen(ticket)).sort(byRecent).slice(0, closedLimit);
  return closed.length ? { mode: "closed", tickets: closed } : { mode: "none", tickets: [] };
}
