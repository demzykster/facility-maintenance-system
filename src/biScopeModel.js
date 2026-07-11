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

const ticketDepartments = (ticket = {}, fleet = []) => {
  const direct = cleanStringList([
    ticket.reportedBy?.dept,
    ticket.createdBy?.dept,
    ticket.department,
    ticket.dept
  ]);
  if (ticketTrack(ticket) !== "transport" || !ticket.forkliftId) return direct;
  const unit = (fleet || []).find((item) => item.id === ticket.forkliftId);
  return cleanStringList([...direct, ...fleetDepartments(unit)]);
};

export const ticketInDepartments = (ticket = {}, departments = [], fleet = []) => {
  if (!departments.length) return false;
  return overlaps(ticketDepartments(ticket, fleet), departments);
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
    ppeItems: [],
    ppeReqs: [],
    ppeOrders: [],
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
    ppeItems = [],
    ppeReqs = [],
    ppeOrders = [],
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
      ppeItems,
      ppeReqs,
      ppeOrders,
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
  const scopedUsers = departments.length ? users.filter((user) => userInDepartments(user, departments)) : [];
  const scopedUserIds = new Set(scopedUsers.map((user) => user.id));
  const scopedPpe = departments.length ? ppe.filter((item) => item.dept && departments.includes(item.dept)) : [];
  const scopedPpeReqs = departments.length
    ? ppeReqs.filter((request) => (request.workerId && scopedUserIds.has(request.workerId)) || (request.dept && departments.includes(request.dept)))
    : [];
  const scopedPpeItemIds = new Set([
    ...scopedPpe.map((item) => item.itemId).filter(Boolean),
    ...scopedPpeReqs.flatMap((request) => (request.lines || []).map((line) => line.itemId).filter(Boolean))
  ]);

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
    pm: pm.filter((record) => {
      const fleetId = record.fleetId || record.forkliftId || record.unitId;
      return fleetId && scopedFleetIds.has(fleetId);
    }),
    zones: scopedZones,
    rounds: rounds.filter((round) => zoneIds.has(round.zoneId)),
    complaints: complaints.filter((complaint) => zoneIds.has(complaint.zoneId)),
    ppe: scopedPpe,
    ppeItems: ppeItems.filter((item) => scopedPpeItemIds.has(item.id)),
    ppeReqs: scopedPpeReqs,
    ppeOrders: [],
    users: scopedUsers
  };
}

const defaultIsOpenTicket = (ticket = {}) => {
  const status = ticket.status || "";
  return !["closed", "done", "resolved", "cancelled", "archived"].includes(status);
};

const riskRow = (name) => ({
  name,
  openTickets: 0,
  slaBreaches: 0,
  criticalDowntime: 0,
  pmOverdue: 0,
  cleaningOpen: 0,
  ppePending: 0,
  score: 0
});

export function biDepartmentRiskRows(data = {}, options = {}) {
  const {
    departments = [],
    tickets = [],
    fleet = [],
    pm = [],
    zones = [],
    complaints = [],
    ppeReqs = []
  } = data;
  const isOpenTicket = options.isOpenTicket || defaultIsOpenTicket;
  const isOverdueTicket = options.isOverdueTicket || (() => false);
  const pmIsOverdue = options.pmIsOverdue || (() => false);
  const complaintNeedsAction = options.complaintNeedsAction || ((complaint) => ["open", "pending"].includes(complaint?.status));
  const ppeRequestNeedsAction = options.ppeRequestNeedsAction || ((request) => ["pending", "worker_sign"].includes(request?.status));
  const rows = new Map(cleanStringList(departments).map((name) => [name, riskRow(name)]));
  const ensure = (name) => {
    const safeName = String(name || "").trim() || "ללא מחלקה";
    if (!rows.has(safeName)) rows.set(safeName, riskRow(safeName));
    return rows.get(safeName);
  };
  const addTo = (names, update) => {
    const cleanNames = cleanStringList(names);
    (cleanNames.length ? cleanNames : ["ללא מחלקה"]).forEach((name) => update(ensure(name)));
  };
  const fleetById = new Map((fleet || []).map((unit) => [unit.id, unit]));
  const zoneDeptById = new Map((zones || []).map((zone) => [zone.id, zone.department || zone.dept || ""]));

  (tickets || []).filter(isOpenTicket).forEach((ticket) => {
    addTo(ticketDepartments(ticket, fleet), (row) => {
      row.openTickets += 1;
      if (isOverdueTicket(ticket)) row.slaBreaches += 1;
      if (ticketTrack(ticket) === "transport" && ticket.downtimeType === "critical") row.criticalDowntime += 1;
    });
  });

  (pm || []).filter(pmIsOverdue).forEach((record) => {
    addTo(fleetDepartments(fleetById.get(record.fleetId || record.forkliftId || record.unitId)), (row) => { row.pmOverdue += 1; });
  });

  (complaints || []).filter(complaintNeedsAction).forEach((complaint) => {
    const departmentsForComplaint = cleanStringList([complaint.dept, complaint.department, zoneDeptById.get(complaint.zoneId)]);
    addTo(departmentsForComplaint.length ? departmentsForComplaint : ["ניקיון"], (row) => { row.cleaningOpen += 1; });
  });

  (ppeReqs || []).filter(ppeRequestNeedsAction).forEach((request) => {
    addTo([request.dept, request.department], (row) => { row.ppePending += 1; });
  });

  return [...rows.values()]
    .map((row) => ({
      ...row,
      score: row.slaBreaches * 5 + row.criticalDowntime * 5 + row.pmOverdue * 3 + row.cleaningOpen * 2 + row.ppePending * 2 + row.openTickets
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.openTickets - a.openTickets || a.name.localeCompare(b.name, "he"));
}
