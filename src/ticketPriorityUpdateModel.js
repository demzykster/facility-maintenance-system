import { DEFAULT_TICKET_SLA_HOURS, normalizeTicketSlaPriority, ticketSlaDueAt } from "./ticketSlaPolicyModel.js";

const PRIORITY_LABELS = Object.freeze({
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה"
});

const clean = (value) => String(value ?? "").trim();
const numberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const TICKET_PRIORITY_UPDATE_ERRORS = Object.freeze({
  forbidden: "ticket_priority_update_forbidden",
  invalid: "ticket_priority_invalid",
  slaUnavailable: "ticket_priority_sla_unavailable"
});

export function normalizeTicketPriorityEditValue(value) {
  return normalizeTicketSlaPriority(clean(value), { fallback: "" });
}

export function canEditTicketPriority(actor = {}) {
  return actor?.role === "admin";
}

export function ticketPriorityLabel(priority) {
  const id = normalizeTicketPriorityEditValue(priority);
  return PRIORITY_LABELS[id] || clean(priority) || "לא הוגדר";
}

export function buildTicketPriorityHistoryEntry({ previousPriority, nextPriority, previousDueAt, nextDueAt, actor = {}, at = Date.now() } = {}) {
  return {
    at,
    by: actor.name || "מנהל מערכת",
    byRole: actor.role || "admin",
    kind: "priority",
    text: `עדיפות עודכנה: ${ticketPriorityLabel(previousPriority)} → ${ticketPriorityLabel(nextPriority)} · יעד SLA עודכן`,
    priorityBefore: previousPriority || "",
    priorityAfter: nextPriority || "",
    dueAtBefore: numberOrNull(previousDueAt),
    dueAtAfter: numberOrNull(nextDueAt)
  };
}

export function applyTicketPriorityUpdate(ticket = {}, priority, { actor = {}, config = {}, fleet = [], now = Date.now() } = {}) {
  if (!canEditTicketPriority(actor)) return { ok: false, error: TICKET_PRIORITY_UPDATE_ERRORS.forbidden };
  const nextPriority = normalizeTicketPriorityEditValue(priority);
  if (!nextPriority || !Object.prototype.hasOwnProperty.call(DEFAULT_TICKET_SLA_HOURS, nextPriority)) {
    return { ok: false, error: TICKET_PRIORITY_UPDATE_ERRORS.invalid };
  }

  const previousPriority = normalizeTicketPriorityEditValue(ticket.priority) || clean(ticket.priority);
  if (previousPriority === nextPriority) {
    return { ok: true, changed: false, ticket };
  }

  const previousDueAt = numberOrNull(ticket.dueAt);
  const due = ticketSlaDueAt({ ...ticket, priority: nextPriority }, config, fleet, { fallbackPriority: false });
  if (!due.ok) return { ok: false, error: TICKET_PRIORITY_UPDATE_ERRORS.slaUnavailable, reason: due.reason };

  const nextDueAt = due.dueAt;
  const historyEntry = buildTicketPriorityHistoryEntry({
    previousPriority,
    nextPriority,
    previousDueAt,
    nextDueAt,
    actor,
    at: now
  });

  return {
    ok: true,
    changed: true,
    before: { priority: previousPriority || "", dueAt: previousDueAt },
    after: { priority: nextPriority, dueAt: nextDueAt },
    historyEntry,
    ticket: {
      ...ticket,
      priority: nextPriority,
      dueAt: nextDueAt,
      updatedAt: now,
      log: [...(Array.isArray(ticket.log) ? ticket.log : []), historyEntry]
    }
  };
}
