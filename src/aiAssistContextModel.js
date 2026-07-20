import { canManage, canView } from "./permissionModel.js";
import { canPerformCleaning, canViewCleaningReports, normalizeCleaningAccess } from "./cleaningAccessModel.js";

const MAX_TICKETS = 28;
const MAX_FLEET = 18;
const MAX_USERS = 24;
const MAX_PM = 12;
const MAX_TASKS = 16;
const MAX_MEETINGS = 10;
const MAX_SUPPLIERS = 12;
const MAX_PPE_ITEMS = 24;
const MAX_PPE_REQUESTS = 16;
const MAX_CLEANING_ZONES = 18;
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
  const cleaningAccess = normalizeCleaningAccess(user);
  return {
    id: compactId(user.id || user.authUserId || user.auth_user_id || user.workerNo),
    workerNo: compactId(user.workerNo || user.worker_no),
    name: compactText(user.name, 120),
    role,
    department: departments[0] || "",
    departments,
    canSeeCompany: LEADERSHIP_ROLES.has(role),
    canSeeFinancials: LEADERSHIP_ROLES.has(role),
    canSeeSuppliers: LEADERSHIP_ROLES.has(role) || canView(user, "suppliers"),
    canManageSuppliers: canManage(user, "suppliers"),
    canSeeCleaning: LEADERSHIP_ROLES.has(role) || canPerformCleaning(user) || canViewCleaningReports(user),
    canCreateCleaningComplaint: role === "admin" || role === "user" || canPerformCleaning(user),
    cleaningZoneIds: cleanStringArray(cleaningAccess.zoneIds, 24)
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

function listIncludesUser(values = [], profile) {
  return asArray(values).some((value) => matchesUserIdentity(value, profile));
}

function isAssignedToUser(record = {}, profile) {
  return matchesUserIdentity(record.assigneeId || record.assignedToId || record.techId || record.ownerId, profile)
    || matchesUserIdentity(record.assigneeWorkerNo || record.workerNo, profile)
    || matchesUserIdentity(record.assignee || record.assignedTo || record.techName || record.ownerName, profile)
    || listIncludesUser([
      ...asArray(record.responsibleIds),
      ...asArray(record.responsible_ids),
      ...asArray(record.participantIds),
      ...asArray(record.participant_ids)
    ], profile);
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

function userAllowed(user, profile) {
  return profile.canSeeCompany
    || matchesUserIdentity(user.id || user.authUserId || user.workerNo || user.name, profile)
    || departmentAllowed(user, profile);
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
    asset: compactText(ticket.asset, 120),
    forkliftId: compactId(ticket.forkliftId || ticket.forklift_id),
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
  const docsDueDays = numberOrNull(unit.docsDueDays ?? unit.documentsDueDays ?? unit.docDays ?? unit.daysLeft);
  const clean = {
    id: compactId(unit.id),
    code: compactText(unit.code || unit.num || unit.number || unit.asset || unit.unitCode || unit.workerNo || unit.workerNumber || unit.vehicleNo || unit.vehicleNumber || unit.registration || unit.registrationNumber || unit.licensePlate || unit.displayNumber || unit.displayNo, 80),
    type: compactText(unit.type || unit.model || unit.title, 80),
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

function sanitizeUser(item = {}) {
  const clean = {
    id: compactId(item.id || item.authUserId || item.auth_user_id || item.workerNo),
    workerNo: compactId(item.workerNo || item.worker_no),
    name: compactText(item.name, 120),
    role: compactText(item.role, 40),
    department: recordDepartments(item)[0] || "",
    departments: cleanStringArray(item.departments || item.depts || item.department || item.dept, 8),
    active: item.active !== false
  };
  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null && !(Array.isArray(value) && value.length === 0)));
}

function sanitizeTask(item = {}) {
  const dueDays = numberOrNull(item.dueDays ?? item.daysLeft);
  const hasDueAt = Object.prototype.hasOwnProperty.call(item, "dueAt") || Object.prototype.hasOwnProperty.call(item, "due_at");
  const dueAt = numberOrNull(item.dueAt ?? item.due_at);
  const clean = {
    id: compactId(item.id),
    title: compactText(item.title || item.subject, 140),
    status: compactText(item.status, 50),
    priority: compactText(item.priority, 50),
    department: recordDepartments(item)[0] || "",
    responsibleIds: cleanStringArray(item.responsibleIds || item.responsible_ids, 8),
    ownerId: compactId(item.ownerId || item.owner_id),
    waitingFor: compactText(item.waitingFor || item.waiting_for, 120),
    category: compactText(item.category, 80),
    locationText: compactText(item.locationText || item.location_text, 120),
    sourceModule: compactText(item.sourceModule || item.source_module, 60),
    meetingId: compactId(item.meetingId || item.meeting_id),
    updatedAt: compactText(item.updatedAt || item.updated_at, 80),
    overdue: booleanOrFalse(item.overdue)
  };
  if (dueDays != null) clean.dueDays = dueDays;
  if (dueAt != null) clean.dueAt = dueAt;
  else if (hasDueAt) clean.dueAt = null;
  return Object.fromEntries(Object.entries(clean).filter(([key, value]) => value !== "" && (key === "dueAt" ? value !== undefined : value != null) && value !== false && !(Array.isArray(value) && value.length === 0)));
}

function sanitizeMeeting(item = {}) {
  const meetingDays = numberOrNull(item.meetingDays ?? item.daysLeft);
  const openTaskCount = numberOrNull(item.openTaskCount);
  const at = numberOrNull(item.at ?? item.meetingAt ?? item.meeting_at);
  const clean = {
    id: compactId(item.id),
    title: compactText(item.title || item.subject, 140),
    type: compactText(item.type, 60),
    status: compactText(item.status, 50),
    department: recordDepartments(item)[0] || "",
    ownerId: compactId(item.ownerId || item.owner_id),
    participantIds: cleanStringArray(item.participantIds || item.participant_ids, 10),
    needsSummary: booleanOrFalse(item.needsSummary)
  };
  if (at != null) clean.at = at;
  if (meetingDays != null) clean.meetingDays = meetingDays;
  if (openTaskCount != null) clean.openTaskCount = openTaskCount;
  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null && value !== false && !(Array.isArray(value) && value.length === 0)));
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

function sanitizePpeItem(item = {}) {
  const totalStock = numberOrNull(item.totalStock ?? item.stock);
  const minStock = numberOrNull(item.minStock);
  const clean = {
    id: compactId(item.id || item.itemId),
    name: compactText(item.name || item.itemName, 120),
    category: compactText(item.category, 60),
    sizes: cleanStringArray(item.sizes || item.sizeOptions, 12),
    lowStock: booleanOrFalse(item.lowStock)
  };
  if (totalStock != null) clean.totalStock = totalStock;
  if (minStock != null) clean.minStock = minStock;
  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null && value !== false && !(Array.isArray(value) && value.length === 0)));
}

function sanitizePpeLine(line = {}) {
  const qty = numberOrNull(line.qty);
  const clean = {
    itemId: compactId(line.itemId || line.id),
    itemName: compactText(line.itemName || line.name, 120),
    category: compactText(line.category, 60),
    size: compactText(line.size, 60)
  };
  if (qty != null) clean.qty = qty;
  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null));
}

function ppeRequestAllowed(request = {}, profile) {
  if (profile.canSeeCompany) return true;
  return matchesUserIdentity(request.workerId || request.workerNo || request.workerName, profile)
    || matchesUserIdentity(request.by?.id || request.by?.workerNo || request.by?.name, profile)
    || departmentAllowed(request, profile);
}

function cleaningZoneAllowed(zone = {}, profile) {
  if (profile.canSeeCompany || profile.canSeeCleaning) return true;
  if (profile.cleaningZoneIds.includes(compactId(zone.id))) return true;
  return matchesUserIdentity(zone.cleanerId || zone.cleanerName, profile);
}

function sanitizePpeRequest(request = {}) {
  const ageDays = numberOrNull(request.ageDays);
  const clean = {
    id: compactId(request.id),
    status: compactText(request.status, 50),
    workerId: compactId(request.workerId),
    workerName: compactText(request.workerName, 120),
    workerNo: compactId(request.workerNo),
    department: compactText(request.department || request.dept, 120),
    lines: asArray(request.lines).slice(0, 6).map(sanitizePpeLine).filter((line) => line.itemId || line.itemName)
  };
  if (ageDays != null) clean.ageDays = ageDays;
  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null && !(Array.isArray(value) && value.length === 0)));
}

function sanitizeCleaningZone(zone = {}) {
  const clean = {
    id: compactId(zone.id),
    code: compactText(zone.code, 80),
    name: compactText(zone.name, 120),
    location: compactText(zone.location || zone.zoneLoc || zone.area || zone.building, 140),
    active: zone.active !== false
  };
  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null && value !== false));
}

function sanitizeMetrics(metrics = {}, profile) {
  const allowed = [
    "openTickets", "overdueTickets", "waitingTickets", "pendingApprovals", "assignedToMe",
    "fleetDocsDue", "pmDue", "ppeOpen", "cleaningOpen", "tasksOpen", "openTasks", "overdueTasks",
    "waitingTasks", "plannedMeetings", "meetingsToSummarize", "unreadNotifications",
    "ppeCatalogActive", "ppeLowStock"
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

function contextLimit(overrides = {}, key = "", fallback = 0) {
  const value = Number(overrides?.[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function buildAiAssistContext(rawContext = {}, user = {}, options = {}) {
  const profile = aiRoleProfile(user);
  const source = rawContext && typeof rawContext === "object" ? rawContext : {};
  const limitOverrides = options?.limits && typeof options.limits === "object" ? options.limits : {};
  const maxFleet = contextLimit(limitOverrides, "fleet", MAX_FLEET);
  const fleetSource = Array.isArray(source.fleet)
    ? source.fleet
    : asArray(source.fleet?.docs || source.fleet?.units || source.fleet?.items);
  const tickets = asArray(source.tickets)
    .filter((ticket) => ticketAllowed(ticket, profile))
    .slice(0, MAX_TICKETS)
    .map((ticket) => sanitizeTicket(ticket, profile));
  const fleet = fleetSource
    .filter((unit) => fleetAllowed(unit, profile))
    .slice(0, maxFleet)
    .map(sanitizeFleet);
  const pm = asArray(source.pm)
    .filter((item) => profile.canSeeCompany || departmentAllowed(item, profile) || isAssignedToUser(item, profile))
    .slice(0, MAX_PM)
    .map(sanitizePm);
  const users = asArray(source.users)
    .filter((item) => item && item.active !== false)
    .filter((item) => userAllowed(item, profile))
    .slice(0, MAX_USERS)
    .map(sanitizeUser);
  const tasks = asArray(source.tasks)
    .filter((item) => profile.canSeeCompany || departmentAllowed(item, profile) || isAssignedToUser(item, profile) || isReportedByUser(item, profile))
    .slice(0, MAX_TASKS)
    .map(sanitizeTask);
  const meetings = asArray(source.meetings)
    .filter((item) => profile.canSeeCompany || departmentAllowed(item, profile) || isAssignedToUser(item, profile))
    .slice(0, MAX_MEETINGS)
    .map(sanitizeMeeting);
  const suppliers = profile.canSeeSuppliers
    ? asArray(source.suppliers)
      .slice(0, MAX_SUPPLIERS)
      .map(sanitizeSupplier)
      .filter((supplier) => supplier.name)
    : [];
  const ppeSource = source.ppe && typeof source.ppe === "object" ? source.ppe : {};
  const ppeItems = asArray(ppeSource.items)
    .slice(0, MAX_PPE_ITEMS)
    .map(sanitizePpeItem)
    .filter((item) => item.id && item.name);
  const ppeRequests = asArray(ppeSource.requests)
    .filter((request) => ppeRequestAllowed(request, profile))
    .slice(0, MAX_PPE_REQUESTS)
    .map(sanitizePpeRequest)
    .filter((request) => request.id);
  const cleaningSource = source.cleaning && typeof source.cleaning === "object" ? source.cleaning : {};
  const cleaningZones = asArray(cleaningSource.zones)
    .filter((zone) => zone && zone.active !== false)
    .filter((zone) => cleaningZoneAllowed(zone, profile))
    .slice(0, MAX_CLEANING_ZONES)
    .map(sanitizeCleaningZone)
    .filter((zone) => zone.id && zone.name);
  return {
    profile: {
      role: profile.role,
      department: profile.department,
      departments: profile.departments,
      canSeeCompany: profile.canSeeCompany,
      canSeeFinancials: profile.canSeeFinancials,
      canSeeSuppliers: profile.canSeeSuppliers,
      capabilities: {
        supplierRouting: profile.canManageSuppliers,
        supplierDirectory: profile.canSeeSuppliers,
        companyScope: profile.canSeeCompany,
        financials: profile.canSeeFinancials,
        cleaningComplaintCreate: profile.canCreateCleaningComplaint
      }
    },
    metrics: sanitizeMetrics(source.metrics || {}, profile),
    bi: sanitizeBiSummary(source.bi || {}, profile),
    tickets,
    fleet,
    users,
    pm,
    tasks,
    meetings,
    suppliers,
    ppe: {
      items: ppeItems,
      requests: ppeRequests
    },
    cleaning: {
      zones: cleaningZones
    },
    limits: {
      tickets: MAX_TICKETS,
      fleet: maxFleet,
      users: MAX_USERS,
      pm: MAX_PM,
      tasks: MAX_TASKS,
      meetings: MAX_MEETINGS,
      suppliers: MAX_SUPPLIERS,
      ppeItems: MAX_PPE_ITEMS,
      ppeRequests: MAX_PPE_REQUESTS,
      cleaningZones: MAX_CLEANING_ZONES,
      heatmap: MAX_HEATMAP_ROWS
    }
  };
}
