export const ADMIN_TICKET_DURATION_FIELDS = [
  "new",
  "in_progress",
  "waiting:parts",
  "waiting:supplier",
  "waiting:no_equipment",
  "waiting:budget_approval",
  "pending_user",
  "pending_admin",
  "rework"
];

const HOUR_MS = 60 * 60 * 1000;

const text = (value) => String(value == null ? "" : value).trim();

export function datetimeValueToMs(value, fallback = null) {
  if (value == null || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function hoursToMs(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.round(hours * HOUR_MS);
}

export function msToHours(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const hours = ms / HOUR_MS;
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 10) / 10);
}

export function statusHoursToMs(hoursByKey = {}) {
  return Object.entries(hoursByKey).reduce((acc, [key, value]) => {
    const ms = hoursToMs(value);
    if (ms > 0) acc[key] = ms;
    return acc;
  }, {});
}

export function statusMsToHours(statusMs = {}) {
  return ADMIN_TICKET_DURATION_FIELDS.reduce((acc, key) => {
    acc[key] = msToHours(statusMs[key]);
    return acc;
  }, {});
}

export function applyAdminTicketManualEdit(ticket, form, {
  session = {},
  now = Date.now()
} = {}) {
  const status = form.status || ticket.status || "new";
  const createdAt = datetimeValueToMs(form.createdAt, ticket.createdAt || now);
  const updatedAt = datetimeValueToMs(form.updatedAt, ticket.updatedAt || now);
  const dueAt = datetimeValueToMs(form.dueAt, ticket.dueAt || null);
  const downtimeStart = datetimeValueToMs(form.downtimeStart, null);
  const downtimeEnd = datetimeValueToMs(form.downtimeEnd, null);
  const closureSignedAt = datetimeValueToMs(form.closureSignedAt, status === "done" ? (ticket.closure?.signedAt || updatedAt) : null);
  const supplier = text(form.supplier);
  const assignee = text(form.assignee);
  const waitingReason = status === "waiting" ? (form.waitingReason || ticket.waitingReason || "other") : null;
  const statusMs = statusHoursToMs(form.statusHours || {});
  const hasManualStatusMs = Object.keys(statusMs).length > 0;
  const historyText = text(form.historyText);
  const historyAt = datetimeValueToMs(form.historyAt, updatedAt);
  const logText = [
    "עריכה ידנית של מנהל מערכת",
    form.status && form.status !== ticket.status ? `סטטוס: ${ticket.status || "—"} → ${status}` : "",
    supplier !== (ticket.supplier || "") ? `ספק: ${ticket.supplier || "—"} → ${supplier || "—"}` : "",
    assignee !== (ticket.assignee || "") ? `אחראי: ${ticket.assignee || "—"} → ${assignee || "—"}` : "",
    hasManualStatusMs ? "עודכנו זמני סטטוסים ידנית" : ""
  ].filter(Boolean).join(" · ");

  const closure = status === "done" ? {
    ...(ticket.closure || {}),
    costAmount: Math.max(0, Number(form.costAmount) || 0),
    costSupplier: text(form.costSupplier || supplier),
    costNote: text(form.costNote),
    quality: form.quality || ticket.closure?.quality || "resolved",
    signedBy: text(form.signedBy) || ticket.closure?.signedBy || session.name || "admin",
    signedAt: closureSignedAt || updatedAt,
    recordedAt: datetimeValueToMs(form.closureRecordedAt, ticket.closure?.recordedAt || now)
  } : null;

  return {
    ...ticket,
    subject: text(form.subject) || ticket.subject,
    description: text(form.description) || ticket.description,
    status,
    waitingReason,
    waitBall: status === "waiting" ? (form.waitBall || ticket.waitBall || "executor") : null,
    supplier,
    assignee,
    routedTech: form.routedTech === undefined ? ticket.routedTech : !!form.routedTech,
    mgrExec: form.mgrExec === undefined ? ticket.mgrExec : !!form.mgrExec,
    priority: form.priority || ticket.priority,
    category: form.category || ticket.category,
    categoryLabel: form.categoryLabel ?? ticket.categoryLabel,
    zone: text(form.zone) || ticket.zone,
    asset: text(form.asset) || ticket.asset,
    downtimeType: form.downtimeType || ticket.downtimeType || null,
    downtimeStart,
    downtimeEnd,
    createdAt,
    updatedAt,
    dueAt,
    closure,
    statusMs: hasManualStatusMs ? statusMs : (ticket.statusMs || {}),
    statusSince: datetimeValueToMs(form.statusSince, status === "done" || status === "cancelled" ? updatedAt : (ticket.statusSince || createdAt)),
    manualTimingOverride: true,
    log: [
      ...(ticket.log || []),
      { at: now, by: session.name || "admin", byRole: session.role || "admin", text: logText, kind: "admin_manual" },
      ...(historyText ? [{ at: historyAt, by: session.name || "admin", byRole: session.role || "admin", text: historyText, kind: "history" }] : [])
    ].sort((a, b) => (a.at || 0) - (b.at || 0))
  };
}
