export const WAITING_TARGET_TYPES = Object.freeze({
  none: "none",
  supplier: "supplier",
  user: "user",
  manager: "manager",
  date: "date"
});

const TARGET_TYPE_SET = new Set(Object.values(WAITING_TARGET_TYPES));
const TARGET_TYPE_BY_REASON = Object.freeze({
  supplier: WAITING_TARGET_TYPES.supplier,
  requester_confirmation: WAITING_TARGET_TYPES.user,
  manager_decision: WAITING_TARGET_TYPES.manager,
  scheduled_date: WAITING_TARGET_TYPES.date
});

const text = (value) => String(value == null ? "" : value).trim();

function waitingUserTarget(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const id = text(value.id || value.userId);
    const name = text(value.name || value.userName);
    return id || name ? { id, name } : null;
  }
  const name = text(value);
  return name ? { id: "", name } : null;
}

function waitingUntilTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const timestamp = typeof value === "number" ? value : Date.parse(String(value));
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function waitingTargetRequirementForReason(reason = "") {
  const type = TARGET_TYPE_BY_REASON[text(reason)] || WAITING_TARGET_TYPES.none;
  return { required: type !== WAITING_TARGET_TYPES.none, type };
}

export function readTicketWaitingTarget(ticket = {}) {
  const declaredType = text(ticket.waitingTargetType);
  const type = TARGET_TYPE_SET.has(declaredType) ? declaredType : WAITING_TARGET_TYPES.none;
  let supplier = "";
  let user = null;
  let until = null;
  let sourceField = "none";

  if (type === WAITING_TARGET_TYPES.supplier) {
    supplier = text(ticket.waitingSupplier);
    sourceField = "waitingSupplier";
  } else if (type === WAITING_TARGET_TYPES.user || type === WAITING_TARGET_TYPES.manager) {
    user = waitingUserTarget(ticket.waitingUser);
    sourceField = "waitingUser";
  } else if (type === WAITING_TARGET_TYPES.date) {
    until = waitingUntilTimestamp(ticket.waitingUntil);
    sourceField = "waitingUntil";
  }

  const complete = !!supplier || !!user || until !== null;

  return { type, complete, sourceField, supplier, user, until };
}

export function getTicketWaitingTargetState(ticket = {}) {
  const requirement = waitingTargetRequirementForReason(ticket.waitingReason);
  const target = readTicketWaitingTarget(ticket);
  return {
    required: requirement.required,
    requiredType: requirement.type,
    satisfied: !requirement.required || (target.type === requirement.type && target.complete),
    target
  };
}
