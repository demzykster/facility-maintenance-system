import {
  getTicketExecutionContext,
  getTicketWaitingContext
} from "./ticketResponsibilitySemanticModel.js";
import { ticketRequesterWaitingTarget } from "./ticketWaitingTargetModel.js";

const text = (value) => String(value == null ? "" : value).trim();
const OPEN_STATUS = new Set(["pending_manager", "rework", "new", "in_progress", "waiting", "pending_user", "pending_admin"]);

export const TICKET_LIST_GROUPS = Object.freeze([
  { key: "waiting_equipment", label: "ממתינות לציוד", icon: "equipment", color: "#DC2626" },
  { key: "waiting_supplier", label: "ממתינות לספק", icon: "supplier", color: "#B45309" },
  { key: "waiting_technician", label: "ממתינות לטכנאי", icon: "technician", color: "#D97706" },
  { key: "waiting_requester", label: "ממתינות לאישור הפותח", icon: "requester", color: "#0D9488" },
  { key: "waiting_manager", label: "ממתינות להחלטת מנהל", icon: "manager", color: "#0D9488" },
  { key: "waiting_scheduled", label: "מתוזמנות", icon: "scheduled", color: "#1F4E8C" },
  { key: "waiting_other", label: "המתנות נוספות", icon: "waiting", color: "#64748B" },
  { key: "approval_manager", label: "ממתינות לאישור מנהל", icon: "approval", color: "#0D9488" },
  { key: "rework", label: "הוחזרו לתיקון", icon: "rework", color: "#D97706" },
  { key: "approval_admin", label: "ממתינות לסגירה מנהלית", icon: "admin", color: "#1F4E8C" },
  { key: "transport_supplier_queue", label: "ממתינות לקבלת טכנאי", icon: "supplierQueue", color: "#B45309" },
  { key: "execution_technician", label: "בטיפול טכנאי", icon: "technician", color: "#D97706" },
  { key: "execution_manager", label: "בטיפול מנהל", icon: "manager", color: "#0D9488" },
  { key: "execution_facility", label: "בטיפול אחזקה", icon: "facility", color: "#1F4E8C" },
  { key: "triage_admin", label: "לטיפול / ניתוב", icon: "admin", color: "#1F4E8C" },
  { key: "execution_unassigned", label: "דורשות בירור שיוך", icon: "unassigned", color: "#64748B" }
]);

const WAITING_GROUP_BY_REASON = Object.freeze({
  no_equipment: "waiting_equipment",
  supplier: "waiting_supplier",
  technician: "waiting_technician",
  requester: "waiting_requester",
  requester_confirmation: "waiting_requester",
  manager: "waiting_manager",
  manager_decision: "waiting_manager",
  scheduled: "waiting_scheduled",
  scheduled_date: "waiting_scheduled"
});

const waitingKind = (reason) => {
  const key = WAITING_GROUP_BY_REASON[text(reason)] || "waiting_other";
  return key.replace(/^waiting_/, "");
};

const cleanList = (values = []) => [...new Set(values.flatMap((value) => Array.isArray(value) ? value : [value]).map(text).filter(Boolean))];

const userDepartments = (user = {}) => cleanList([user.depts, user.departments, user.dept, user.department]);

function ticketApprovalDepartments(ticket = {}, fleet = []) {
  const unit = ticket.forkliftId ? (fleet || []).find((item) => item?.id === ticket.forkliftId) : null;
  return cleanList([
    ticket.createdBy?.dept,
    ticket.createdBy?.department,
    ticket.reportedBy?.dept,
    ticket.reportedBy?.department,
    ticket.dept,
    ticket.department,
    unit?.depts,
    unit?.departments,
    unit?.dept,
    unit?.department
  ]);
}

function activeManagers(users = []) {
  return (users || []).filter((user) => user?.active !== false && user?.role === "user");
}

function managerApprovalTarget(ticket = {}, { users = [], fleet = [] } = {}) {
  const managers = activeManagers(users);
  const creator = ticket.createdBy || {};
  if (creator.role === "user") {
    const exact = managers.find((user) => (creator.id && user.id === creator.id) || (creator.name && user.name === creator.name));
    if (exact) return { id: text(exact.id), name: text(exact.name), source: "creator_manager" };
    if (text(creator.name)) return { id: text(creator.id), name: text(creator.name), source: "creator_manager" };
  }

  const departments = ticketApprovalDepartments(ticket, fleet);
  const manager = managers.find((user) => userDepartments(user).some((department) => departments.includes(department)));
  if (manager) return { id: text(manager.id), name: text(manager.name), source: "department_manager" };
  return null;
}

export function getTicketApprovalContext(ticket = {}, options = {}) {
  if (ticket.status === "pending_user" || ticket.status === "pending_manager") {
    const target = managerApprovalTarget(ticket, options);
    return {
      isApproval: true,
      type: "manager_completion",
      authority: "department_manager",
      target
    };
  }
  if (ticket.status === "pending_admin") {
    return {
      isApproval: true,
      type: "admin_closure",
      authority: "admin",
      target: { id: "", name: "מנהל המערכת", source: "role" }
    };
  }
  return { isApproval: false, type: "none", authority: "none", target: null };
}

export function getTicketLifecycleContext(ticket = {}, options = {}) {
  const approval = getTicketApprovalContext(ticket, options);
  if (approval.type === "manager_completion") return { stage: "manager_approval", approval };
  if (approval.type === "admin_closure") return { stage: "admin_closure", approval };
  if (ticket.status === "waiting") return { stage: "waiting", approval };
  if (ticket.status === "rework" || ticket.returned === true) return { stage: "rework", approval };
  if (ticket.status === "done" || ticket.status === "cancelled") return { stage: "closed", approval };
  return { stage: "execution", approval };
}

function executionGroupKey(ticket, execution) {
  if (execution.track === "transport") {
    if (execution.mode === "technician") return "execution_technician";
    if (execution.mode === "supplier_queue") return "transport_supplier_queue";
    return "execution_unassigned";
  }
  if (execution.mode === "manager_execution") return "execution_manager";
  if (ticket.status === "new") return "triage_admin";
  if (execution.mode === "technician" || execution.mode === "admin_triage" || execution.mode === "supplier_queue" || execution.mode === "technician_pool") return "execution_facility";
  return "execution_unassigned";
}

export function ticketListGroupKey(ticket = {}, options = {}) {
  const lifecycle = getTicketLifecycleContext(ticket, options);
  if (lifecycle.stage === "manager_approval") return "approval_manager";
  if (lifecycle.stage === "admin_closure") return "approval_admin";
  if (lifecycle.stage === "waiting") {
    const waiting = getTicketWaitingContext(ticket, options);
    return WAITING_GROUP_BY_REASON[waiting.reason] || "waiting_other";
  }
  if (lifecycle.stage === "rework") return "rework";
  return executionGroupKey(ticket, getTicketExecutionContext(ticket, options));
}

export function semanticTicketListGroups(tickets = [], options = {}) {
  const byKey = new Map(TICKET_LIST_GROUPS.map((group) => [group.key, { ...group, tickets: [] }]));
  for (const ticket of tickets || []) {
    const key = ticketListGroupKey(ticket, options);
    (byKey.get(key) || byKey.get("execution_unassigned")).tickets.push(ticket);
  }
  return TICKET_LIST_GROUPS.map((group) => byKey.get(group.key)).filter((group) => group.tickets.length > 0);
}

function waitingUserName(ticket = {}) {
  const value = ticket.waitingUser;
  if (value && typeof value === "object") return text(value.name || value.userName);
  return text(value);
}

function dateValue(value, formatDateTime, fallback) {
  const timestamp = typeof value === "number" ? value : Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp) || timestamp <= 0) return fallback;
  return typeof formatDateTime === "function"
    ? formatDateTime(timestamp)
    : new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function facilityResponsibleValue(ticket, execution) {
  if (execution.responsibleUser) return execution.responsibleUser;
  if (execution.managerExecution) return "מנהל מחלקה";
  return "מנהל המערכת";
}

function executionRows(ticket, execution) {
  if (execution.track === "transport") {
    const technician = execution.responsibleUser || "טרם נבחר";
    const rows = [];
    if (execution.responsibleUser) rows.push({ kind: "technician", label: "טכנאי", value: technician, tone: "process" });
    if (execution.supplier) rows.push({ kind: "supplier", label: "ספק", value: execution.supplier, tone: "supplier" });
    if (!execution.responsibleUser) rows.push({ kind: "technician", label: "טכנאי", value: technician, tone: "muted" });
    return rows;
  }

  const rows = [{ kind: "responsible", label: "אחראי", value: facilityResponsibleValue(ticket, execution), tone: execution.managerExecution ? "manager" : "info" }];
  if (execution.supplier) rows.push({ kind: "contractor", label: "ספק / קבלן", value: execution.supplier, tone: "supplier" });
  return rows;
}

function waitingPresentation(ticket, waiting, formatDateTime) {
  const kind = waitingKind(waiting.reason);
  const target = waiting.target || {};
  const explicitUser = text(target.user?.name) || waitingUserName(ticket);
  const explicitSupplier = text(target.supplier) || text(ticket.waitingSupplier);

  if (kind === "supplier") return { kind, label: "ממתינים ל", value: explicitSupplier || "לא נבחר ספק" };
  if (kind === "technician") return { kind, label: "ממתינים ל", value: explicitUser || "לא נבחר טכנאי" };
  if (kind === "requester") {
    const requester = ticketRequesterWaitingTarget(ticket);
    return { kind, label: "ממתינים לאישור", value: explicitUser || text(requester?.name) || "לא נבחר פותח" };
  }
  if (kind === "manager") return { kind, label: "ממתינים ל", value: explicitUser || "מנהל מחלקה" };
  if (kind === "scheduled") return { kind, label: "חזרה לטיפול", value: dateValue(target.until || ticket.waitingUntil, formatDateTime, "לא נבחר תאריך") };
  if (kind === "equipment") {
    const requester = ticketRequesterWaitingTarget(ticket);
    return { kind, label: "ממתינים ל", value: explicitUser || text(requester?.name) || "העברת הכלי" };
  }

  const fallbackByReason = {
    parts: "חלקים",
    access: "גישה",
    safety_hold: "אישור בטיחות",
    budget_approval: "אישור תקציב",
    external_contractor: explicitSupplier || "לא נבחר קבלן"
  };
  return {
    kind,
    label: "ממתינים ל",
    value: explicitUser || explicitSupplier || fallbackByReason[waiting.reason] || "לא נבחר"
  };
}

function approvalPresentation(approval) {
  if (approval.type === "manager_completion") {
    return { kind: "manager_approval", label: "ממתינים לאישור", value: text(approval.target?.name) || "מנהל המחלקה" };
  }
  if (approval.type === "admin_closure") {
    return { kind: "admin_closure", label: "ממתינות לסגירה", value: "מנהל המערכת" };
  }
  return null;
}

export function ticketListCardSemantics(ticket = {}, options = {}) {
  const execution = getTicketExecutionContext(ticket, options);
  const lifecycle = getTicketLifecycleContext(ticket, options);
  const rows = executionRows(ticket, execution);
  const waiting = lifecycle.stage === "waiting" ? getTicketWaitingContext(ticket, options) : null;
  const waitingRow = waiting?.isWaiting ? waitingPresentation(ticket, waiting, options.formatDateTime || options.formatDate) : null;
  const responsibilityRow = execution.track === "transport"
    ? (rows.find((row) => row.kind === "technician") || { label: "טכנאי", value: "טרם נבחר", tone: "muted" })
    : rows[0];
  const open = OPEN_STATUS.has(text(ticket.status) || "new");
  return {
    lifecycle,
    responsibility: {
      label: responsibilityRow.label,
      value: responsibilityRow.value,
      mode: execution.mode
    },
    executionRows: rows,
    waiting: waitingRow,
    approval: approvalPresentation(lifecycle.approval),
    scheduled: waitingRow?.kind === "scheduled" ? { label: waitingRow.label, value: waitingRow.value } : null,
    sla: open ? { label: "יעד SLA", value: dateValue(ticket.dueAt, options.formatDateTime || options.formatDate, "לא הוגדר") } : null
  };
}
