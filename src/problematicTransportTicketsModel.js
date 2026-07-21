import { fleetDepartments, ticketDepartments } from "./biScopeModel.js";

const HOUR_MS = 60 * 60 * 1000;
const LONG_DOWNTIME_MS = 48 * HOUR_MS;

export const PROBLEMATIC_TRANSPORT_REASON = Object.freeze({
  UNNATURAL_DAMAGE: "unnatural_damage",
  LONG_DOWNTIME: "long_downtime",
  CLOSED_WITH_COST: "closed_with_cost"
});

const CLOSED_STATUSES = new Set(["done", "closed", "resolved"]);

const finiteTimestamp = (value) => {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
};

const meaningfulCost = (value) => {
  if (value == null || String(value).trim() === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const isTransportTicket = (ticket = {}) =>
  ticket.track === "transport" || (!ticket.track && Boolean(ticket.forkliftId));

const isClosedTicket = (ticket = {}) => CLOSED_STATUSES.has(ticket.status || "");

const isCriticalDowntimeTicket = (ticket = {}) =>
  (ticket.downtimeType || ticket.downtime_type) === "critical";

const downtimeEnd = (ticket, now) => {
  const recordedEnd = finiteTimestamp(ticket.backInServiceAt)
    || finiteTimestamp(ticket.downtimeEnd);
  if (recordedEnd) return recordedEnd;
  if (!isClosedTicket(ticket)) return now;
  return finiteTimestamp(ticket.closure?.signedAt)
    || finiteTimestamp(ticket.closedAt)
    || finiteTimestamp(ticket.updatedAt);
};

const ticketDisplayDate = (ticket = {}) =>
  finiteTimestamp(ticket.closure?.signedAt)
  || finiteTimestamp(ticket.closedAt)
  || finiteTimestamp(ticket.createdAt)
  || finiteTimestamp(ticket.updatedAt);

const rowPriority = (row) => {
  if (row.reasons.includes(PROBLEMATIC_TRANSPORT_REASON.UNNATURAL_DAMAGE)) return 0;
  if (row.activeLongDowntime) return 1;
  if (row.reasons.includes(PROBLEMATIC_TRANSPORT_REASON.CLOSED_WITH_COST)) return 2;
  return 3;
};

export function problematicTransportTicketRows(tickets = [], options = {}) {
  const fleet = options.fleet || [];
  const zones = options.zones || [];
  const allowedFleetIds = Array.isArray(options.allowedFleetIds) ? new Set(options.allowedFleetIds) : null;
  const now = finiteTimestamp(options.now) || Date.now();
  const rowsByTicket = new Map();

  (tickets || []).forEach((ticket) => {
    if (!isTransportTicket(ticket)) return;
    if (allowedFleetIds && (!ticket.forkliftId || !allowedFleetIds.has(ticket.forkliftId))) return;

    const reasons = [];
    const start = finiteTimestamp(ticket.downtimeStart);
    const end = start ? downtimeEnd(ticket, now) : null;
    const downtimeMs = start && end ? Math.max(0, end - start) : null;
    const costAmount = isClosedTicket(ticket) ? meaningfulCost(ticket.closure?.costAmount) : null;

    if (ticket.wearType === "disproportionate") {
      reasons.push(PROBLEMATIC_TRANSPORT_REASON.UNNATURAL_DAMAGE);
    }
    if (isCriticalDowntimeTicket(ticket) && downtimeMs != null && downtimeMs > LONG_DOWNTIME_MS) {
      reasons.push(PROBLEMATIC_TRANSPORT_REASON.LONG_DOWNTIME);
    }
    if (costAmount != null) {
      reasons.push(PROBLEMATIC_TRANSPORT_REASON.CLOSED_WITH_COST);
    }
    if (!reasons.length) return;

    const unit = fleet.find((candidate) => candidate.id === ticket.forkliftId) || null;
    rowsByTicket.set(ticket.id, {
      ticket,
      unit,
      departments: unit ? fleetDepartments(unit) : ticketDepartments(ticket, fleet, zones),
      reasons,
      downtimeMs,
      costAmount,
      displayDate: ticketDisplayDate(ticket),
      activeLongDowntime: reasons.includes(PROBLEMATIC_TRANSPORT_REASON.LONG_DOWNTIME)
        && !isClosedTicket(ticket)
        && !finiteTimestamp(ticket.backInServiceAt)
        && !finiteTimestamp(ticket.downtimeEnd)
    });
  });

  return [...rowsByTicket.values()]
    .sort((left, right) =>
      rowPriority(left) - rowPriority(right)
      || (right.downtimeMs || 0) - (left.downtimeMs || 0)
      || (right.displayDate || 0) - (left.displayDate || 0))
    .slice(0, Number.isFinite(options.maxRows) ? Math.max(0, options.maxRows) : undefined);
}
