import { visibleTicketsForSession } from "../../src/ticketVisibilityModel.js";

const FULL_READ_ROLES = new Set(["admin", "executive"]);
const FLEET_CONTEXT_ROLES = new Set(["user", "tech"]);
const TICKET_WRITE_ROLES = new Set(["admin", "user", "tech", "worker"]);

const cleanRole = (session = {}) => String(session?.role || "").trim();

export function canReadTicketsRole(session = {}) {
  return ["admin", "executive", "user", "tech", "worker"].includes(cleanRole(session));
}

async function fleetContextForTicketRead(session = {}, fleetDriver = null) {
  const role = cleanRole(session);
  if (!FLEET_CONTEXT_ROLES.has(role) || typeof fleetDriver?.list !== "function") return [];
  return fleetDriver.list({ limit: 2000 });
}

export async function ticketsForSessionReadScope(session = {}, tickets = [], { fleetDriver = null } = {}) {
  const list = Array.isArray(tickets) ? tickets : [];
  if (FULL_READ_ROLES.has(cleanRole(session))) return list;
  const fleet = await fleetContextForTicketRead(session, fleetDriver);
  return visibleTicketsForSession(session, list, fleet);
}

export async function canReadTicketInSessionScope(session = {}, ticket = null, { fleetDriver = null } = {}) {
  if (!ticket) return false;
  if (FULL_READ_ROLES.has(cleanRole(session))) return true;
  const scoped = await ticketsForSessionReadScope(session, [ticket], { fleetDriver });
  return scoped.length === 1;
}

export async function ticketWritePermissionError(session = {}, ticket = null, { fleetDriver = null, action = "update" } = {}) {
  if (!await canReadTicketInSessionScope(session, ticket, { fleetDriver })) {
    return "permission_required:tickets:write_scope";
  }
  const role = cleanRole(session);
  if (!TICKET_WRITE_ROLES.has(role)) return "permission_required:role:admin|user|tech|worker";
  if (String(action || "").trim().toLowerCase() === "delete" && role !== "admin") {
    return "permission_required:tickets:delete";
  }
  return null;
}
