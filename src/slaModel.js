export const pausedMs = (ticket, now = Date.now()) => (
  (ticket?.pauseAccumMs || 0) + (ticket?.pauseSince ? Math.max(0, now - ticket.pauseSince) : 0)
);

export const operationalElapsedMs = (ticket, at = Date.now()) => (
  Math.max(0, (at ?? Date.now()) - (ticket?.createdAt ?? at ?? Date.now()) - pausedMs(ticket, at))
);

export const operationalSlaMs = (ticket) => (
  ticket?.dueAt != null && ticket?.createdAt != null ? Math.max(0, ticket.dueAt - ticket.createdAt) : 0
);

export const operationalRemainingMs = (ticket, now = Date.now()) => {
  const sla = operationalSlaMs(ticket);
  if (!sla) return null;
  return sla - operationalElapsedMs(ticket, now);
};

export const isOperationallyOverdue = (ticket, now = Date.now()) => (
  !!operationalSlaMs(ticket)
  && operationalRemainingMs(ticket, now) < 0
  && ticket?.status !== "done"
  && ticket?.status !== "cancelled"
);

export const metOperationalSla = (ticket, closedAt = ticket?.closure?.signedAt ?? ticket?.updatedAt) => {
  const sla = operationalSlaMs(ticket);
  if (!sla || !closedAt) return false;
  return operationalElapsedMs(ticket, closedAt) <= sla;
};

export const operationalSlaRatio = (ticket, closedAt = ticket?.closure?.signedAt ?? ticket?.updatedAt) => {
  const sla = operationalSlaMs(ticket);
  if (!sla || !closedAt) return null;
  return operationalElapsedMs(ticket, closedAt) / sla;
};

export const missedOperationalSla = (ticket, now = Date.now()) => {
  if (!operationalSlaMs(ticket) || ticket?.status === "cancelled") return false;
  if (ticket?.status === "done") return !metOperationalSla(ticket);
  return isOperationallyOverdue(ticket, now);
};
