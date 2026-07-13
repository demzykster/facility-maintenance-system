import { canView } from "./permissionModel.js";

const MAX_TICKETS = 28;
const MAX_FLEET = 18;
const MAX_PM = 12;
const MAX_SUPPLIERS = 12;
const MAX_HEATMAP_ROWS = 8;
const MAX_TEXT = 160;

const LEADERSHIP_ROLES = new Set(["admin", "executive"]);

const compactText = (value, limit = MAX_TEXT) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const compactId = (value) => compactText(value, 80);

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
};

const cleanStringArray = (value, limit = 12) => asArray(value)
  .map((item) => compactText(item, 80))
  .filter(Boolean)
  .slice(0, limit);

const numberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const booleanOrFalse = (value) => value === true;

export function aiRoleProfile(user = {}) {
  const role = compactText(user.role, 40);
  const departments = cleanStringArray(user.departments || user.depts || user.department || user.dept);
  return {
    id: compactId(user.id || user.authUserId || user.auth_user_id || user.workerNo),
    workerNo: compactId(user.workerNo || user.worker_no),
    name: compactText(user.name, 120),
    role,
    department: departments[0] || "",
    departments,
    canSeeCompany: LEADERSHIP_ROLES.has(role),
    canSeeFinancials: LEADERSHIP_ROLES.has(role),
    canSeeSuppliers: LEADERSHIP_ROLES.has(role) || canView(user, "suppliers")
  };
}

function recordDepartments(record = {}) {
  return cleanStringArray(record.departments || record.depts || record.department || record.dept || record.ownerDepartment || record.ownerDept || record.zoneDepartment);
}

function departmentAllowed(record, profile) {
  if (profile.canSeeCompany) return true;
  if (!profile.departments.length) return false;
  const departments = recordDepartments(record);
  return departments.some((department) => profile.departments.includes(department));
}

function matchesUserIdentity(value, profile) {
  const candidate = compactText(value, 120);
  return !!candidate && [profile.id, profile.workerNo, profile.name].filter(Boolean).includes(candidate);
}

function isAssignedToUser(record = {}, profile) {
  return matchesUserIdentity(record.assigneeId || record.assignedToId || record.techId || record.ownerId, profile)
    || matchesUserIdentity(record.assigneeWorkerNo || record.workerNo, profile)
    || matchesUserIdentity(record.assignee || record.assignedTo || record.techName || record.ownerName, profile);
}

function isReportedByUser(record = {}, profile) {
  const reportedBy = record.reportedBy || record.requester || record.createdBy || {};
  if (typeof reportedBy === "string") return matchesUserIdentity(reportedBy, profile);
  return matchesUserIdentity(reportedBy.id || reportedBy.userId || reportedBy.workerNo || reportedBy.name, profile)
    || matchesUserIdentity(record.reportedById || record.requesterId || record.createdById, profile)
    || matchesUserIdentity(record.reportedByName || record.requesterName || record.createdByName, profile);
}

function ticketAllowed(ticket, profile) {
  if (profile.canSeeCompany) return true;
  if (profile.role === "tech") return isAssignedToUser(ticket, profile) || departmentAllowed(ticket, profile);
  if (profile.role === "worker" || profile.role === "cleaner") return isReportedByUser(ticket, profile);
  return departmentAllowed(ticket, profile) || isReportedByUser(ticket, profile) || isAssignedToUser(ticket, profile);
}

function fleetAllowed(unit, profile) {
  return profile.canSeeCompany || departmentAllowed(unit, profile) || isAssignedToUser(unit, profile);
}

function sanitizeTicket(ticket = {}, profile) {
  const clean = {
    id: compactId(ticket.id),
    number: compactText(ticket.number || ticket.no || ticket.ticketNo || ticket.num, 80),
    track: compactText(ticket.track, 40),
    subject: compactText(ticket.subject || ticket.title, 140),
    status: compactText(ticket.status, 50),
    priority: compactText(ticket.priority, 50),
    department: recordDepartments(ticket)[0] || "",
    zone: compactText(ticket.zone || ticket.area || ticket.location, 80),
    assignee: compactText(ticket.assignee || ticket.assignedTo || ticket.techName, 120),
    supplier: compactText(ticket.supplier, 120),
    waitReason: compactText(ticket.waitReason || ticket.waitingReason, 80),
    ageDays: numberOrNull(ticket.ageDays),
    idleDays: numberOrNull(ticket.idleDays),
    overdue: booleanOrFalse(ticket.overdue),
    updatedAt: compactText(ticket.updatedAt || ticket.updated || ticket.at, 80)
  };
  if (profile.canSeeFinancials) {
    const cost = numberOrNull(ticket.cost || ticket.actualCost || ticket.estimatedCost);
    if (cost != null) clean.cost = cost;
  }
  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null && value !== false));
}

function sanitizeFleet(unit = {}) {
  const docsDueDays = numberOrNull(unit.docsDueDays ?? unit.documentsDueDays ?? unit.docDays);
  const clean = {
    id: compactId(unit.id),
    code: compactText(unit.code || unit.number || unit.asset, 80),
    type: compactText(unit.type || unit.model, 80),
    department: recordDepartments(unit)[0] || "",
    supplier: compactText(unit.supplier, 120),
    status: compactText(unit.status, 60)
  };
  if (docsDueDays != null) clean.docsDueDays = docsDueDays;
  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null));
}

function sanitizePm(item = {}) {
  const dueDays = numberOrNull(item.dueDays ?? item.daysLeft);
  const clean = {
    id: compactId(item.id),
    title: compactText(item.title || item.name, 120),
    asset: compactText(item.asset || item.code || item.unitCode, 80),
    status: compactText(item.status, 60)
  };
  if (dueDays != null) clean.dueDays = dueDays;
  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null));
}

function sanitizeSupplier(item = {}) {
  const fleetCount = numberOrNull(item.fleetCount);
  const openTicketCount = numberOrNull(item.openTicketCount);
  const clean = {
    name: compactText(item.name, 120),
    type: compactText(item.type, 50),
    scopes: cleanStringArray(item.scopes || item.industries, 8)
  };
  if (fleetCount != null) clean.fleetCount = fleetCount;
  if (openTicketCount != null) clean.openTicketCount = openTicketCount;
  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null && !(Array.isArray(value) && value.length === 0)));
}

function sanitizeMetrics(metrics = {}, profile) {
  const allowed = [
    "openTickets", "overdueTickets", "waitingTickets", "pendingApprovals", "assignedToMe",
    "fleetDocsDue", "pmDue", "ppeOpen", "cleaningOpen", "tasksOpen", "unreadNotifications"
  ];
  if (profile.canSeeFinancials) allowed.push("totalCost", "monthlyCost", "estimatedCost");
  return Object.fromEntries(allowed
    .map((key) => [key, numberOrNull(metrics[key])])
    .filter(([, value]) => value != null));
}

function sanitizeHeatmapRow(row = {}, profile) {
  const department = compactText(row.department || row.name, 120);
  const record = { department };
  if (!departmentAllowed(record, profile)) return null;
  const total = numberOrNull(row.total);
  const primary = row.primaryRisk && typeof row.primaryRisk === "object" ? row.primaryRisk : null;
  const tags = asArray(row.riskTags)
    .slice(0, 3)
    .map((tag) => ({
      key: compactText(tag?.key, 50),
      label: compactText(tag?.label, 80),
      value: numberOrNull(tag?.value)
    }))
    .filter((tag) => tag.key && tag.label && tag.value != null);
  const clean = {
    department,
    total,
    primaryRisk: primary ? {
      key: compactText(primary.key, 50),
      label: compactText(primary.label, 80),
      value: numberOrNull(primary.value)
    } : null,
    riskTags: tags
  };
  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null));
}

function sanitizeBiSummary(bi = {}, profile) {
  const source = bi && typeof bi === "object" ? bi : {};
  const heatmap = asArray(source.heatmap)
    .map((row) => sanitizeHeatmapRow(row, profile))
    .filter(Boolean)
    .slice(0, MAX_HEATMAP_ROWS);
  return heatmap.length ? { heatmap } : {};
}

export function buildAiAssistContext(rawContext = {}, user = {}) {
  const profile = aiRoleProfile(user);
  const source = rawContext && typeof rawContext === "object" ? rawContext : {};
  const tickets = asArray(source.tickets)
    .filter((ticket) => ticketAllowed(ticket, profile))
    .slice(0, MAX_TICKETS)
    .map((ticket) => sanitizeTicket(ticket, profile));
  const fleet = asArray(source.fleet)
    .filter((unit) => fleetAllowed(unit, profile))
    .slice(0, MAX_FLEET)
    .map(sanitizeFleet);
  const pm = asArray(source.pm)
    .filter((item) => profile.canSeeCompany || departmentAllowed(item, profile) || isAssignedToUser(item, profile))
    .slice(0, MAX_PM)
    .map(sanitizePm);
  const suppliers = profile.canSeeSuppliers
    ? asArray(source.suppliers)
      .slice(0, MAX_SUPPLIERS)
      .map(sanitizeSupplier)
      .filter((supplier) => supplier.name)
    : [];
  return {
    profile: {
      role: profile.role,
      department: profile.department,
      departments: profile.departments,
      canSeeCompany: profile.canSeeCompany,
      canSeeFinancials: profile.canSeeFinancials,
      canSeeSuppliers: profile.canSeeSuppliers
    },
    metrics: sanitizeMetrics(source.metrics || {}, profile),
    bi: sanitizeBiSummary(source.bi || {}, profile),
    tickets,
    fleet,
    pm,
    suppliers,
    limits: {
      tickets: MAX_TICKETS,
      fleet: MAX_FLEET,
      pm: MAX_PM,
      suppliers: MAX_SUPPLIERS,
      heatmap: MAX_HEATMAP_ROWS
    }
  };
}
