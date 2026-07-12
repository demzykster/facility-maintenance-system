const statusTimingKey = (ticket) => ticket?.status === "waiting"
  ? `waiting:${ticket.waitingReason || "other"}`
  : (ticket?.status || "new");

const transitionTime = (ticket, now) => {
  const raw = ticket?.statusTransitionAt;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return now;
  return Math.min(now, value);
};

export function applyTicketStatusTiming(nextTicket, previousTicket, now = Date.now()) {
  let rec = { ...nextTicket };
  const at = transitionTime(rec, now);
  const manualTimingOverride = rec.manualTimingOverride === true;
  delete rec.statusTransitionAt;
  delete rec.manualTimingOverride;

  if (manualTimingOverride) {
    return {
      ...rec,
      statusMs: rec.statusMs || {},
      statusSince: rec.statusSince || rec.updatedAt || rec.createdAt || at
    };
  }

  if (!previousTicket) {
    return {
      ...rec,
      statusMs: rec.statusMs || {},
      statusSince: rec.statusSince || rec.createdAt || at
    };
  }

  const prevKey = statusTimingKey(previousTicket);
  const nextKey = statusTimingKey(rec);
  if (prevKey !== nextKey) {
    const statusStartedAt = previousTicket.statusSince || previousTicket.createdAt || at;
    const effectiveAt = Math.max(statusStartedAt, at);
    const statusMs = { ...(previousTicket.statusMs || {}) };
    statusMs[prevKey] = (statusMs[prevKey] || 0) + Math.max(0, effectiveAt - statusStartedAt);
    return { ...rec, statusMs, statusSince: effectiveAt };
  }

  return {
    ...rec,
    statusMs: rec.statusMs || previousTicket.statusMs || {},
    statusSince: rec.statusSince || previousTicket.statusSince || previousTicket.createdAt || at
  };
}
