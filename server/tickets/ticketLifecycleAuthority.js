const clean = (value) => String(value ?? "").trim();

const TERMINAL_STATUS = new Set(["done", "cancelled"]);

const ALLOWED_TRANSITIONS = Object.freeze({
  pending_manager: Object.freeze(["new", "rework", "cancelled"]),
  rework: Object.freeze(["pending_manager", "cancelled"]),
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
      "in_progress:waiting",
      "waiting:in_progress",
      "in_progress:pending_user",
      "waiting:pending_user",
      "in_progress:cancelled",
      "waiting:cancelled"
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
      "pending_admin:in_progress"
    ].includes(`${from}:${to}`);
  }
  return false;
}

export function ticketLifecycleTransitionError(actor = {}, previousTicket = {}, nextTicket = {}) {
  if (!statusChanged(previousTicket, nextTicket)) return null;
  const from = statusOf(previousTicket);
  const to = statusOf(nextTicket);
  if (TERMINAL_STATUS.has(from)) return "ticket_transition_from_terminal_forbidden";
  if (!allowedByMatrix(from, to)) return `ticket_transition_forbidden:${from}:${to}`;
  if (!actorCanDriveTransition(actor, previousTicket, nextTicket)) return `ticket_transition_role_forbidden:${roleOf(actor) || "unknown"}:${from}:${to}`;
  return null;
}
