import { getTicketExecutionContext, getTicketWaitingContext } from "./ticketResponsibilitySemanticModel.js";
import { getTicketLifecycleContext } from "./ticketListSemanticModel.js";
import { ticketRequesterWaitingTarget } from "./ticketWaitingTargetModel.js";

const CLOSED_STATUSES = new Set(["closed", "done", "resolved", "cancelled", "archived"]);

const text = (value) => String(value == null ? "" : value).trim();

const isOpenTicket = (ticket = {}) => !CLOSED_STATUSES.has(text(ticket.status));

const stableKey = (type, value = "") =>
  `${type}:${text(value).toLowerCase() || "unknown"}`;

function managerTargetName(lifecycle = {}) {
  return text(lifecycle.approval?.target?.name) || "מנהל מחלקה";
}

function requesterTargetName(ticket = {}, waiting = {}) {
  return text(waiting.target?.user?.name)
    || text(ticket.waitingUser?.name || ticket.waitingUser)
    || text(ticketRequesterWaitingTarget(ticket)?.name)
    || "";
}

function executionParty(ticket = {}, execution = {}) {
  if (execution.track === "transport") {
    if (execution.mode === "supplier_queue") {
      return execution.supplier
        ? {
            type: "transport_supplier_queue",
            key: stableKey("transport_supplier_queue", execution.supplier),
            label: execution.supplier,
            description: "תור ספק שינוע"
          }
        : {
            type: "unclear",
            key: "unclear:transport_supplier_queue",
            label: "דורש בירור שיוך",
            description: "תור ספק ללא ספק"
          };
    }
    if (execution.responsibleUser) {
      return {
        type: "technician",
        key: stableKey("technician", execution.responsibleUser),
        label: execution.responsibleUser,
        description: execution.supplier ? `טכנאי · ${execution.supplier}` : "טכנאי"
      };
    }
    return {
      type: "unclear",
      key: "unclear:transport_execution",
      label: "דורש בירור שיוך",
      description: "שינוע ללא טכנאי או ספק"
    };
  }

  if (execution.mode === "manager_execution") {
    return {
      type: "manager",
      key: stableKey("manager", execution.responsibleUser || "manager"),
      label: execution.responsibleUser || "מנהל מחלקה",
      description: "בטיפול מנהל"
    };
  }

  if (execution.responsibleUser) {
    return {
      type: "internal_admin",
      key: stableKey("internal_admin", execution.responsibleUser),
      label: execution.responsibleUser,
      description: "אחזקה פנימית"
    };
  }

  if (ticket.status === "new" || execution.mode === "admin_triage" || execution.mode === "supplier_queue" || execution.mode === "technician_pool") {
    return {
      type: "internal_admin",
      key: "internal_admin:system",
      label: "מנהל המערכת",
      description: execution.supplier ? `אחזקה · ${execution.supplier}` : "ניתוב / טיפול"
    };
  }

  return {
    type: "unclear",
    key: "unclear:facility_execution",
    label: "דורש בירור שיוך",
    description: "מבנה ללא אחראי"
  };
}

function waitingParty(ticket = {}, waiting = {}, execution = {}) {
  const reason = text(waiting.reason);
  if (reason === "supplier") {
    const supplier = text(waiting.target?.supplier) || text(ticket.waitingSupplier);
    return supplier
      ? {
          type: "waiting_supplier",
          key: stableKey("waiting_supplier", supplier),
          label: supplier,
          description: "ממתינים לספק"
        }
      : {
          type: "unclear",
          key: "unclear:waiting_supplier",
          label: "דורש בירור שיוך",
          description: "ממתינים לספק ללא יעד"
        };
  }

  if (reason === "requester" || reason === "requester_confirmation") {
    const requester = requesterTargetName(ticket, waiting);
    return requester
      ? {
          type: "requester",
          key: stableKey("requester", requester),
          label: requester,
          description: "אישור הפותח"
        }
      : {
          type: "unclear",
          key: "unclear:requester",
          label: "דורש בירור שיוך",
          description: "אישור פותח ללא פותח"
        };
  }

  if (reason === "manager" || reason === "manager_decision") {
    const manager = text(waiting.target?.user?.name) || text(ticket.waitingUser?.name || ticket.waitingUser) || "מנהל מחלקה";
    return {
      type: "manager",
      key: stableKey("manager", manager),
      label: manager,
      description: "החלטת מנהל"
    };
  }

  if (reason === "technician") {
    const technician = text(waiting.target?.user?.name) || text(ticket.waitingUser?.name || ticket.waitingUser);
    return technician
      ? {
          type: "waiting_user",
          key: stableKey("waiting_user", technician),
          label: technician,
          description: "ממתינים לטכנאי"
        }
      : {
          type: "unclear",
          key: "unclear:waiting_technician",
          label: "דורש בירור שיוך",
          description: "ממתינים לטכנאי ללא יעד"
        };
  }

  if (reason === "scheduled" || reason === "scheduled_date") {
    return {
      type: "scheduled_date",
      key: "scheduled_date:return",
      label: "מועד מתוכנן",
      description: "חזרה לטיפול"
    };
  }

  if (waiting.actionOwner === "admin") {
    return { type: "internal_admin", key: "internal_admin:system", label: "מנהל המערכת", description: "המתנה לטיפול מערכת" };
  }
  if (waiting.actionOwner === "manager") {
    return { type: "manager", key: "manager:department", label: "מנהל מחלקה", description: "המתנה למנהל" };
  }
  return executionParty(ticket, execution);
}

export function ticketNextResponsibleParty(ticket = {}, options = {}) {
  const lifecycle = getTicketLifecycleContext(ticket, options);
  const execution = getTicketExecutionContext(ticket, options);

  if (!isOpenTicket(ticket) || lifecycle.stage === "closed") {
    return { type: "closed", key: "closed:closed", label: "סגורה", description: "לא פתוחה" };
  }
  if (lifecycle.stage === "manager_approval") {
    const manager = managerTargetName(lifecycle);
    return {
      type: "manager",
      key: stableKey("manager", manager),
      label: manager,
      description: "אישור סיום"
    };
  }
  if (lifecycle.stage === "admin_closure") {
    return {
      type: "internal_admin",
      key: "internal_admin:system",
      label: "מנהל המערכת",
      description: "סגירה מנהלית"
    };
  }
  if (lifecycle.stage === "waiting") {
    return waitingParty(ticket, getTicketWaitingContext(ticket, options), execution);
  }
  if (lifecycle.stage === "rework") {
    return executionParty(ticket, execution);
  }
  return executionParty(ticket, execution);
}

const TYPE_PRIORITY = Object.freeze({
  unclear: 0,
  waiting_supplier: 1,
  waiting_user: 2,
  requester: 3,
  manager: 4,
  technician: 5,
  transport_supplier_queue: 6,
  internal_admin: 7,
  scheduled_date: 8,
  closed: 99
});

export function nextResponsiblePartyRows(tickets = [], options = {}) {
  const maxRows = Number.isFinite(options.maxRows) ? Math.max(0, options.maxRows) : Infinity;
  const rowsByKey = new Map();

  (tickets || []).filter(isOpenTicket).forEach((ticket) => {
    const party = ticketNextResponsibleParty(ticket, options);
    if (party.type === "closed") return;
    const row = rowsByKey.get(party.key) || {
      key: party.key,
      type: party.type,
      label: party.label,
      description: party.description,
      n: 0,
      tickets: []
    };
    row.n += 1;
    row.tickets.push(ticket);
    rowsByKey.set(party.key, row);
  });

  return [...rowsByKey.values()]
    .sort((left, right) =>
      (TYPE_PRIORITY[left.type] ?? 50) - (TYPE_PRIORITY[right.type] ?? 50)
      || right.n - left.n
      || left.label.localeCompare(right.label, "he"))
    .slice(0, maxRows);
}

export function ticketMatchesNextResponsibleParty(ticket = {}, key = "", options = {}) {
  if (!key) return true;
  return ticketNextResponsibleParty(ticket, options).key === key;
}
