import { DEFAULT_TRANSPORT_DOWNTIME_LEVELS, downtimeLevelOf, transportCreateDowntimeLevels, transportPriorityForDowntimeType } from "./ticketCreateContract.js";
import { ticketSlaDueAt } from "./ticketSlaPolicyModel.js";

const clean = (value) => String(value ?? "").trim();
const numberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const TICKET_DOWNTIME_UPDATE_ERRORS = Object.freeze({
  forbidden: "ticket_downtime_update_forbidden",
  unsupportedTrack: "ticket_downtime_update_unsupported_track",
  invalid: "ticket_downtime_update_invalid",
  slaUnavailable: "ticket_downtime_update_sla_unavailable"
});

export function canEditTicketDowntime(actor = {}) {
  return actor?.role === "admin";
}

export function normalizeTicketDowntimeEditValue(value, config = {}, fallbackLevels = DEFAULT_TRANSPORT_DOWNTIME_LEVELS) {
  const id = clean(value);
  if (!id) return "";
  return transportCreateDowntimeLevels(config, fallbackLevels).some((level) => level?.id === id) ? id : "";
}

export function ticketDowntimeLabel(downtimeType, config = {}, fallbackLevels = DEFAULT_TRANSPORT_DOWNTIME_LEVELS) {
  const id = clean(downtimeType);
  return downtimeLevelOf(id, config, fallbackLevels).label || id || "לא הוגדר";
}

export function buildTicketDowntimeHistoryEntry({ previousDowntimeType, nextDowntimeType, previousPriority, nextPriority, previousDueAt, nextDueAt, actor = {}, config = {}, at = Date.now() } = {}) {
  return {
    at,
    by: actor.name || "מנהל מערכת",
    byRole: actor.role || "admin",
    kind: "downtime_type",
    text: `מצב הכלי עודכן: ${ticketDowntimeLabel(previousDowntimeType, config)} → ${ticketDowntimeLabel(nextDowntimeType, config)} · יעד SLA עודכן`,
    downtimeTypeBefore: previousDowntimeType || "",
    downtimeTypeAfter: nextDowntimeType || "",
    priorityBefore: previousPriority || "",
    priorityAfter: nextPriority || "",
    dueAtBefore: numberOrNull(previousDueAt),
    dueAtAfter: numberOrNull(nextDueAt)
  };
}

export function applyTicketDowntimeUpdate(ticket = {}, downtimeType, { actor = {}, config = {}, fleet = [], now = Date.now(), fallbackLevels = DEFAULT_TRANSPORT_DOWNTIME_LEVELS } = {}) {
  if (!canEditTicketDowntime(actor)) return { ok: false, error: TICKET_DOWNTIME_UPDATE_ERRORS.forbidden };
  const track = ticket.track || (ticket.forkliftId ? "transport" : "facility");
  if (track !== "transport") return { ok: false, error: TICKET_DOWNTIME_UPDATE_ERRORS.unsupportedTrack };

  const nextDowntimeType = normalizeTicketDowntimeEditValue(downtimeType, config, fallbackLevels);
  if (!nextDowntimeType) return { ok: false, error: TICKET_DOWNTIME_UPDATE_ERRORS.invalid };

  const previousDowntimeType = clean(ticket.downtimeType);
  const nextPriority = transportPriorityForDowntimeType(nextDowntimeType, config, fallbackLevels);
  if (!nextPriority) return { ok: false, error: TICKET_DOWNTIME_UPDATE_ERRORS.invalid };
  const previousPriority = clean(ticket.priority);

  if (previousDowntimeType === nextDowntimeType && previousPriority === nextPriority) {
    return { ok: true, changed: false, ticket };
  }

  const previousDueAt = numberOrNull(ticket.dueAt);
  const due = ticketSlaDueAt({ ...ticket, priority: nextPriority, downtimeType: nextDowntimeType }, config, fleet, { fallbackPriority: false });
  if (!due.ok) return { ok: false, error: TICKET_DOWNTIME_UPDATE_ERRORS.slaUnavailable, reason: due.reason };

  const nextDueAt = due.dueAt;
  const historyEntry = buildTicketDowntimeHistoryEntry({
    previousDowntimeType,
    nextDowntimeType,
    previousPriority,
    nextPriority,
    previousDueAt,
    nextDueAt,
    actor,
    config,
    at: now
  });

  return {
    ok: true,
    changed: true,
    before: { downtimeType: previousDowntimeType || "", priority: previousPriority || "", dueAt: previousDueAt },
    after: { downtimeType: nextDowntimeType, priority: nextPriority, dueAt: nextDueAt },
    historyEntry,
    ticket: {
      ...ticket,
      downtimeType: nextDowntimeType,
      priority: nextPriority,
      dueAt: nextDueAt,
      updatedAt: now,
      log: [...(Array.isArray(ticket.log) ? ticket.log : []), historyEntry]
    }
  };
}
