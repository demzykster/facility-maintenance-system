import { biTicketHeatmapRows } from "./biScopeModel.js";

const dayMs = 86400000;

const asArray = (value) => Array.isArray(value) ? value : [];

const defaultIsOpenTicket = (ticket = {}) =>
  !["done", "closed", "cancelled", "archived"].includes(String(ticket.status || ""));

const defaultTicketNumber = (ticket = {}) =>
  ticket?.num ? String(ticket.num) : String(ticket?.id || "").slice(-6) || "";

const defaultStatusLabel = (status) => String(status || "");
const defaultPriorityLabel = (priority) => String(priority || "");
const defaultTrackOf = (ticket = {}) => ticket.track || (ticket.forkliftId ? "transport" : "facility");
const defaultWaitReasonLabel = (ticket = {}) => ticket.status === "waiting" ? String(ticket.waitingReason || "") : "";
const defaultFormatDateTime = (timestamp) => timestamp ? new Date(timestamp).toISOString() : "";
const defaultDaysLeft = (timestamp, now) => Math.ceil((timestamp - now) / dayMs);
const defaultPmFleet = (task = {}, fleet = []) => fleet.find((unit) => unit.id === task.forkliftId || unit.id === task.equipmentId);
const defaultDocStatus = () => ({ d: null, label: "" });

function supplierTypeFromMeta(meta = {}) {
  if (meta.type) return String(meta.type);
  const industries = Array.isArray(meta.industries) ? meta.industries : [];
  if (industries.includes("transport")) return "transport";
  if (industries.includes("clothing")) return "goods";
  if (industries.some((item) => String(item || "").startsWith("facility:"))) return "facility";
  return "";
}

export function buildAIContextSnapshot({
  session = {},
  tickets = [],
  pm = [],
  fleet = [],
  config = {},
  now = Date.now(),
  isOpenTicket = defaultIsOpenTicket,
  isOverdueTicket = () => false,
  requiresManagerAction = () => false,
  ticketNumber = defaultTicketNumber,
  statusLabel = defaultStatusLabel,
  priorityLabel = defaultPriorityLabel,
  trackOf = defaultTrackOf,
  waitReasonLabel = defaultWaitReasonLabel,
  formatDateTime = defaultFormatDateTime,
  daysLeft = defaultDaysLeft,
  pmFleet = defaultPmFleet,
  docStatus = defaultDocStatus,
  maxTickets = 60,
  maxFleet = 30,
  maxPm = 24,
  maxSuppliers = 18,
  maxHeatmapRows = 6
} = {}) {
  const ticketList = asArray(tickets);
  const fleetList = asArray(fleet);
  const pmList = asArray(pm);
  const openTickets = ticketList.filter(isOpenTicket);

  const mapTicket = (ticket) => ({
    id: ticket.id,
    number: ticketNumber(ticket),
    track: trackOf(ticket),
    subject: ticket.subject,
    status: statusLabel(ticket.status),
    priority: priorityLabel(ticket.priority),
    department: ticket.dept || ticket.department || "",
    zone: ticket.zone || "",
    assignee: ticket.assignee || "",
    supplier: ticket.supplier || "",
    waitReason: waitReasonLabel(ticket),
    ageDays: Math.max(0, Math.round((now - (ticket.createdAt || now)) / dayMs)),
    idleDays: Math.max(0, Math.round((now - (ticket.updatedAt || ticket.createdAt || now)) / dayMs)),
    overdue: isOverdueTicket(ticket),
    updatedAt: ticket.updatedAt ? formatDateTime(ticket.updatedAt) : "",
    cost: ticket.closure?.costAmount || ticket.costAmount || ticket.cost || null,
    reportedBy: ticket.reportedBy || null,
    reportedById: ticket.reportedById || ticket.requesterId || "",
    reportedByName: ticket.reportedByName || ticket.requesterName || ""
  });

  const fleetNearDocs = fleetList
    .map((unit) => ({ unit, status: docStatus(unit) || defaultDocStatus(unit) }))
    .filter(({ status }) => status.d != null && status.d <= 45)
    .map(({ unit, status }) => ({
      id: unit.id,
      code: unit.code,
      type: unit.type || unit.model,
      department: unit.department || unit.dept || "",
      supplier: unit.supplier || "",
      status: status.label,
      docsDueDays: status.d
    }));

  const pmDue = pmList
    .filter((item) => item.active !== false && daysLeft(item.nextDue, now) <= 14)
    .map((item) => {
      const unit = pmFleet(item, fleetList);
      return {
        id: item.id,
        title: item.title,
        asset: unit ? unit.code : item.forkliftId || item.equipmentId || "",
        department: unit?.department || unit?.dept || "",
        dueDays: daysLeft(item.nextDue, now),
        status: item.active === false ? "inactive" : "active"
      };
    });

  const suppliers = asArray(config.suppliers)
    .filter(Boolean)
    .slice(0, maxSuppliers)
    .map((name) => {
      const supplierName = String(name || "");
      const meta = config.supplierMeta?.[supplierName] || {};
      return {
        name: supplierName,
        type: supplierTypeFromMeta(meta),
        scopes: asArray(meta.industries).slice(0, 8),
        fleetCount: fleetList.filter((unit) => unit.supplier === supplierName).length,
        openTicketCount: openTickets.filter((ticket) => ticket.supplier === supplierName).length
      };
    });

  const heatmapRows = biTicketHeatmapRows({
    departments: config.departments || [],
    tickets: openTickets,
    fleet: fleetList,
    zones: config.zones || []
  }, {
    now,
    isOpenTicket,
    isOverdueTicket,
    maxRows: maxHeatmapRows
  }).map((row) => ({
    department: row.name,
    total: row.total,
    primaryRisk: row.primaryRisk ? {
      key: row.primaryRisk.key,
      label: row.primaryRisk.label,
      value: row.primaryRisk.value
    } : null,
    riskTags: row.riskTags
  }));

  return {
    metrics: {
      openTickets: openTickets.length,
      overdueTickets: ticketList.filter(isOverdueTicket).length,
      waitingTickets: ticketList.filter((ticket) => ticket.status === "waiting").length,
      pendingApprovals: ticketList.filter((ticket) => requiresManagerAction(session, ticket)).length,
      assignedToMe: ticketList.filter((ticket) => ticket.assignee === session.name).length,
      fleetDocsDue: fleetNearDocs.length,
      pmDue: pmDue.length,
      totalCost: ticketList.reduce((sum, ticket) => sum + (Number(ticket.closure?.costAmount || ticket.costAmount || ticket.cost || 0) || 0), 0)
    },
    bi: {
      heatmap: heatmapRows
    },
    tickets: openTickets.slice(0, maxTickets).map(mapTicket),
    fleet: fleetNearDocs.slice(0, maxFleet),
    pm: pmDue.slice(0, maxPm),
    suppliers
  };
}
