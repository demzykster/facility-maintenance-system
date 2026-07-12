import { BI_UNASSIGNED_DEPARTMENT, ticketDepartments } from "./biScopeModel.js";

const clean = (value) => String(value || "").trim();

export function biFocusDepartmentMatches(ticket = {}, focus = {}, { fleet = [], zones = [] } = {}) {
  const target = clean(focus.department);
  if (!target) return true;
  const departments = ticketDepartments(ticket, fleet, zones);
  if (target === BI_UNASSIGNED_DEPARTMENT) return departments.length === 0;
  return departments.includes(target);
}

export function recurringFacilityZoneRows(tickets = [], { isOpenTicket = () => false, minCount = 2 } = {}) {
  const rows = new Map();
  (tickets || []).forEach((ticket) => {
    const zone = clean(ticket.zone || ticket.zoneId || ticket.location);
    if (!zone) return;
    const row = rows.get(zone) || { key: zone, label: zone, n: 0, open: 0 };
    row.n += 1;
    if (isOpenTicket(ticket)) row.open += 1;
    rows.set(zone, row);
  });
  return [...rows.values()]
    .filter((row) => row.n >= minCount || row.open >= minCount)
    .sort((a, b) => b.open - a.open || b.n - a.n || a.label.localeCompare(b.label, "he"));
}
