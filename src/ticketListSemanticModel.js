import {
  getTicketExecutionContext,
  getTicketWaitingContext
} from "./ticketResponsibilitySemanticModel.js";
import { ticketRequesterWaitingTarget } from "./ticketWaitingTargetModel.js";

const text = (value) => String(value == null ? "" : value).trim();

export const TICKET_LIST_GROUPS = Object.freeze([
  { key: "waiting_equipment", label: "ממתינות לציוד", icon: "equipment", color: "#DC2626" },
  { key: "waiting_supplier", label: "ממתינות לספק", icon: "supplier", color: "#B45309" },
  { key: "waiting_technician", label: "ממתינות לטכנאי", icon: "technician", color: "#D97706" },
  { key: "waiting_requester", label: "ממתינות לאישור הפותח", icon: "requester", color: "#0D9488" },
  { key: "waiting_manager", label: "ממתינות להחלטת מנהל", icon: "manager", color: "#0D9488" },
  { key: "waiting_scheduled", label: "מתוזמנות", icon: "scheduled", color: "#1F4E8C" },
  { key: "waiting_other", label: "המתנות נוספות", icon: "waiting", color: "#64748B" },
  { key: "execution_admin", label: "לטיפול / סגירה על ידך", icon: "admin", color: "#1F4E8C" },
  { key: "execution_manager", label: "בטיפול מנהל", icon: "manager", color: "#0D9488" },
  { key: "execution_technician", label: "בטיפול הטכנאי", icon: "technician", color: "#D97706" },
  { key: "execution_supplier", label: "בטיפול ספק / קבלן", icon: "supplier", color: "#B45309" },
  { key: "execution_unassigned", label: "טרם שויכו", icon: "unassigned", color: "#64748B" }
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

function executionGroupKey(ticket, execution) {
  if (ticket.status === "pending_admin") return "execution_admin";
  if (ticket.status === "pending_manager" || ticket.status === "pending_user") return "execution_manager";
  if (execution.mode === "admin_triage") return "execution_admin";
  if (execution.mode === "manager_execution") return "execution_manager";
  if (execution.mode === "technician" || execution.mode === "technician_pool") return "execution_technician";
  if (execution.mode === "supplier_queue") return "execution_supplier";
  return "execution_unassigned";
}

export function ticketListGroupKey(ticket = {}, options = {}) {
  if (ticket.status === "waiting") {
    const waiting = getTicketWaitingContext(ticket, options);
    return WAITING_GROUP_BY_REASON[waiting.reason] || "waiting_other";
  }
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

function waitingDateValue(value, formatDate) {
  const timestamp = typeof value === "number" ? value : Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "לא נבחר תאריך";
  return typeof formatDate === "function"
    ? formatDate(timestamp)
    : new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(timestamp);
}

function responsibilityValue(execution) {
  if (execution.responsibleUser) return execution.responsibleUser;
  if (execution.mode === "supplier_queue" && execution.supplier) return execution.supplier;
  if (execution.mode === "admin_triage") return "מנהל המערכת";
  if (execution.mode === "manager_execution") return "מנהל מחלקה";
  if (execution.mode === "technician_pool") return "טרם נבחר טכנאי";
  return "לא נבחר";
}

function waitingPresentation(ticket, waiting, formatDate) {
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
  if (kind === "scheduled") return { kind, label: "חזרה לטיפול", value: waitingDateValue(target.until || ticket.waitingUntil, formatDate) };
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

export function ticketListCardSemantics(ticket = {}, options = {}) {
  const execution = getTicketExecutionContext(ticket, options);
  const waiting = ticket.status === "waiting" ? getTicketWaitingContext(ticket, options) : null;
  return {
    responsibility: {
      label: "אחראי",
      value: responsibilityValue(execution),
      mode: execution.mode
    },
    waiting: waiting?.isWaiting ? waitingPresentation(ticket, waiting, options.formatDate) : null
  };
}
