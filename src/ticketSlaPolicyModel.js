export const DEFAULT_TICKET_SLA_HOURS = Object.freeze({
  high: 4,
  medium: 24,
  low: 72
});

const PRIORITY_ALIAS = Object.freeze({ urgent: "high" });
const OPEN_STATUS = new Set(["new", "in_progress", "waiting", "pending_manager", "pending_user", "pending_admin", "rework"]);
const SLA_POLICY_FIELDS = ["catSla", "typeSla", "modelType"];

const clean = (value) => String(value ?? "").trim();
const numberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function normalizeTicketSlaPriority(priority, { fallback = "medium" } = {}) {
  const id = PRIORITY_ALIAS[priority] || priority;
  if (Object.prototype.hasOwnProperty.call(DEFAULT_TICKET_SLA_HOURS, id)) return id;
  return fallback && Object.prototype.hasOwnProperty.call(DEFAULT_TICKET_SLA_HOURS, fallback) ? fallback : "";
}

export const ticketSlaBaseAt = (ticket = {}) => {
  const base = numberOrNull(ticket.slaBaseAt ?? ticket.sla_base_at ?? ticket.approvedAt ?? ticket.approved_at ?? ticket.createdAt ?? ticket.created_at);
  return base != null && base >= 0 ? base : null;
};

export const unitSlaModelCode = (unit = {}) => clean(unit?.model || unit?.type);

export function unitSlaTypeName(unit = {}, config = {}) {
  if (!unit) return "";
  const explicit = clean(unit.vehicleKind);
  if (explicit) return explicit;
  const legacyMapped = clean(config?.modelType?.[unit.type]);
  if (legacyMapped) return legacyMapped;
  const configuredTypes = Array.isArray(config?.forkliftTypes) ? config.forkliftTypes : [];
  if (configuredTypes.some((type) => clean(type?.name) === clean(unit.type))) return clean(unit.type);
  return clean(unit.notes || unit.type);
}

export function resolveTicketSlaPolicy(ticket = {}, config = {}, fleet = [], { fallbackPriority = true } = {}) {
  if (ticket.slaHoursOverride != null && clean(ticket.slaHoursOverride) !== "") {
    const hours = numberOrNull(ticket.slaHoursOverride);
    return hours && hours > 0 ? { ok: true, hours, source: "manual_override" } : { ok: false, reason: "invalid_manual_override" };
  }

  const priority = normalizeTicketSlaPriority(ticket.priority, { fallback: fallbackPriority ? "medium" : "" });
  if (!priority) return { ok: false, reason: "unknown_priority" };

  const track = clean(ticket.track) || (ticket.forkliftId ? "transport" : "facility");
  if (track === "transport" || ticket.forkliftId) {
    const unitId = clean(ticket.forkliftId || ticket.assetId || ticket.asset_id);
    const unit = (fleet || []).find((item) => clean(item.id) === unitId) || null;
    const typeName = unitSlaTypeName(unit, config);
    const modelCode = unitSlaModelCode(unit);
    const typeHours = numberOrNull(config?.typeSla?.[typeName]?.[priority]);
    if (typeName && typeHours && typeHours > 0) return { ok: true, hours: typeHours, source: "transport_type", key: typeName, priority };
    const modelHours = numberOrNull(config?.typeSla?.[modelCode]?.[priority]);
    if (modelCode && modelHours && modelHours > 0) return { ok: true, hours: modelHours, source: "transport_model", key: modelCode, priority };
    return { ok: true, hours: DEFAULT_TICKET_SLA_HOURS[priority], source: "default", priority };
  }

  const category = clean(ticket.category || ticket.cat);
  const categoryHours = numberOrNull(config?.catSla?.[category]?.[priority]);
  if (category && categoryHours && categoryHours > 0) return { ok: true, hours: categoryHours, source: "facility_category", key: category, priority };
  return { ok: true, hours: DEFAULT_TICKET_SLA_HOURS[priority], source: "default", priority };
}

export function resolveTicketSlaHours(ticket = {}, config = {}, fleet = []) {
  const policy = resolveTicketSlaPolicy(ticket, config, fleet);
  return policy.ok ? policy.hours : DEFAULT_TICKET_SLA_HOURS.medium;
}

export function ticketSlaDueAt(ticket = {}, config = {}, fleet = [], options = {}) {
  const baseAt = ticketSlaBaseAt(ticket);
  if (baseAt == null) return { ok: false, reason: "missing_base_timestamp" };
  const policy = resolveTicketSlaPolicy(ticket, config, fleet, options);
  if (!policy.ok) return policy;
  return { ...policy, baseAt, dueAt: baseAt + policy.hours * 3600000 };
}

export function slaPolicyFieldsChanged(previousConfig = {}, nextConfig = {}) {
  return SLA_POLICY_FIELDS.some((field) => JSON.stringify(previousConfig?.[field] || {}) !== JSON.stringify(nextConfig?.[field] || {}));
}

export async function synchronizeOpenTicketSlaWithPolicy({
  previousConfig = {},
  nextConfig = {},
  tickets = [],
  fleet = [],
  updateTicket = null,
  now = Date.now()
} = {}) {
  const summary = { checked: 0, updated: 0, skipped: 0, ambiguous: 0, failed: 0, policyChanged: slaPolicyFieldsChanged(previousConfig, nextConfig) };
  if (!summary.policyChanged || typeof updateTicket !== "function") return summary;

  for (const ticket of tickets || []) {
    if (!OPEN_STATUS.has(clean(ticket.status) || "new")) {
      summary.skipped += 1;
      continue;
    }
    summary.checked += 1;
    if (ticket.slaHoursOverride != null && clean(ticket.slaHoursOverride) !== "") {
      summary.skipped += 1;
      continue;
    }
    const due = ticketSlaDueAt(ticket, nextConfig, fleet, { fallbackPriority: false });
    if (!due.ok) {
      summary.ambiguous += 1;
      continue;
    }
    const currentDueAt = numberOrNull(ticket.dueAt);
    if (currentDueAt != null && Math.abs(currentDueAt - due.dueAt) < 1) {
      summary.skipped += 1;
      continue;
    }
    try {
      await updateTicket({ ...ticket, dueAt: due.dueAt, slaPolicySyncedAt: now });
      summary.updated += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
