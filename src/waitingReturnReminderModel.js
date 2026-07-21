import { ticketNextResponsibilityKey } from "./ticketNextResponsibilityModel.js";
import { visibleTicketsForSession } from "./ticketVisibilityModel.js";

const OPEN_WAITING_STATUSES = new Set(["waiting"]);

const timestamp = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Date.parse(String(value));
  return Number.isFinite(n) && n > 0 ? n : null;
};

function sessionOwnsNextStep(session = {}, ticket = {}, options = {}) {
  const key = ticketNextResponsibilityKey(ticket, options);
  if (key === "admin") return session.role === "admin";
  if (key === "manager") return session.role === "user";
  if (key === "tech") return session.role === "tech";
  return false;
}

export function waitingReturnReminderEventsForSession({
  session = {},
  tickets = [],
  fleet = [],
  now = Date.now(),
  ticketNo = (ticket) => ticket.num || ticket.id || "",
  trackLabel = (ticket) => ticket.track || ""
} = {}) {
  const visible = visibleTicketsForSession(session, tickets, fleet);
  return visible
    .filter((ticket) => OPEN_WAITING_STATUSES.has(String(ticket?.status || "").trim()))
    .map((ticket) => ({ ticket, until: timestamp(ticket.waitingUntil) }))
    .filter(({ ticket, until }) => until != null && until <= now && sessionOwnsNextStep(session, ticket, { fleet }))
    .map(({ ticket, until }) => ({
      key: `wait-return-${ticket.id}-${until}`,
      at: until,
      ticketId: ticket.id,
      kind: "waiting",
      go: "tickets",
      title: `חזרה לטיפול · #${ticketNo(ticket)}`,
      body: `${trackLabel(ticket)} · ${ticket.subject || "קריאה"}`
    }));
}
