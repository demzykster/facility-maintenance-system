import { canViewCompanyBI, canViewFinancialBI } from "./permissionModel.js";

export const cleanStringList = (values = []) =>
  [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];

export const userDepartments = (user = {}) =>
  cleanStringList(user.depts?.length ? user.depts : (user.dept ? [user.dept] : []));

export const fleetDepartments = (unit = {}) =>
  cleanStringList(unit.depts?.length ? unit.depts : (unit.dept ? [unit.dept] : []));

const overlaps = (left = [], right = []) => {
  const rightSet = new Set(right);
  return left.some((item) => rightSet.has(item));
};

const ticketTrack = (ticket = {}) => ticket.track || (ticket.forkliftId ? "transport" : "facility");

export const ticketInDepartments = (ticket = {}, departments = [], fleet = []) => {
  if (!departments.length) return false;
  if (ticket.reportedBy?.dept && departments.includes(ticket.reportedBy.dept)) return true;
  if (ticket.createdBy?.dept && departments.includes(ticket.createdBy.dept)) return true;
  if (ticket.department && departments.includes(ticket.department)) return true;
  if (ticket.dept && departments.includes(ticket.dept)) return true;
  if (ticketTrack(ticket) === "transport" && ticket.forkliftId) {
    const unit = (fleet || []).find((item) => item.id === ticket.forkliftId);
    if (unit && overlaps(fleetDepartments(unit), departments)) return true;
  }
  return false;
};

const userInDepartments = (user = {}, departments = []) =>
  overlaps(userDepartments(user), departments) || (user.dept && departments.includes(user.dept));

const zoneIsShared = (zone = {}) =>
  zone.shared === true || zone.isShared === true || zone.scope === "shared" || zone.department === "shared" || zone.dept === "shared";

const zoneInDepartments = (zone = {}, departments = []) => {
  if (zoneIsShared(zone)) return true;
  if (zone.department && departments.includes(zone.department)) return true;
  if (zone.dept && departments.includes(zone.dept)) return true;
  return false;
};

export function biScopeForSession(session, data = {}) {
  const empty = {
    kind: "none",
    departments: [],
    zoneIds: [],
    canViewCompanyBI: false,
    canViewFinancialBI: false,
    tickets: [],
    fleet: [],
    pm: [],
    zones: [],
    rounds: [],
    complaints: [],
    ppe: [],
    users: []
  };
  if (!session) return empty;

  const {
    tickets = [],
    fleet = [],
    pm = [],
    zones = [],
    rounds = [],
    complaints = [],
    ppe = [],
    users = []
  } = data;

  if (canViewCompanyBI(session)) {
    return {
      kind: "company",
      departments: [],
      zoneIds: zones.map((zone) => zone.id).filter(Boolean),
      canViewCompanyBI: true,
      canViewFinancialBI: canViewFinancialBI(session),
      tickets,
      fleet,
      pm,
      zones,
      rounds,
      complaints,
      ppe,
      users
    };
  }

  if (session.role !== "user") return empty;

  const departments = userDepartments(session);
  const zoneIds = new Set(cleanStringList(session.mgrZones || []));
  const scopedZones = zones.filter((zone) => zoneIds.has(zone.id) || (departments.length > 0 && zoneInDepartments(zone, departments)));
  scopedZones.forEach((zone) => zone.id && zoneIds.add(zone.id));
  const scopedFleet = departments.length
    ? fleet.filter((unit) => overlaps(fleetDepartments(unit), departments))
    : [];
  const scopedFleetIds = new Set(scopedFleet.map((unit) => unit.id));

  return {
    kind: "department",
    departments,
    zoneIds: [...zoneIds],
    canViewCompanyBI: false,
    canViewFinancialBI: false,
    tickets: departments.length
      ? tickets.filter((ticket) => ticketInDepartments(ticket, departments, fleet))
      : [],
    fleet: scopedFleet,
    pm: pm.filter((record) => record.fleetId && scopedFleetIds.has(record.fleetId)),
    zones: scopedZones,
    rounds: rounds.filter((round) => zoneIds.has(round.zoneId)),
    complaints: complaints.filter((complaint) => zoneIds.has(complaint.zoneId)),
    ppe: departments.length ? ppe.filter((item) => item.dept && departments.includes(item.dept)) : [],
    users: departments.length ? users.filter((user) => userInDepartments(user, departments)) : []
  };
}
