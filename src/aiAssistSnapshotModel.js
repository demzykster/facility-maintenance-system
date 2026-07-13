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
const defaultTaskOpen = (task = {}) => !["done", "cancelled", "closed", "archived"].includes(String(task.status || ""));

const cleanStringList = (values = [], limit = 12) => (Array.isArray(values) ? values : [])
  .map((value) => String(value || "").trim())
  .filter(Boolean)
  .slice(0, limit);

const cleanStringValues = (values = [], limit = 12) => cleanStringList(Array.isArray(values) ? values : (values ? [values] : []), limit);

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
  users = [],
  tasks = [],
  meetings = [],
  ppeItems = [],
  ppeReqs = [],
  config = {},
  now = Date.now(),
  isOpenTicket = defaultIsOpenTicket,
  isOverdueTicket = () => false,
  isOpenTask = defaultTaskOpen,
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
  maxUsers = 24,
  maxPm = 24,
  maxTasks = 24,
  maxMeetings = 12,
  maxSuppliers = 18,
  maxPpeItems = 24,
  maxPpeRequests = 16,
  maxHeatmapRows = 6
} = {}) {
  const ticketList = asArray(tickets);
  const fleetList = asArray(fleet);
  const userList = asArray(users);
  const pmList = asArray(pm);
  const taskList = asArray(tasks);
  const meetingList = asArray(meetings);
  const ppeItemList = asArray(ppeItems);
  const ppeRequestList = asArray(ppeReqs);
  const openTickets = ticketList.filter(isOpenTicket);
  const openTasks = taskList.filter(isOpenTask);
  const activePpeItems = ppeItemList.filter((item) => item && item.active !== false);
  const openPpeRequests = ppeRequestList.filter((request) => ["pending", "worker_sign"].includes(String(request?.status || "pending")));

  const ppeSizesForItem = (item = {}) => {
    const explicit = cleanStringList(item.sizes || item.sizeOptions || Object.keys(item.stockBySize || {}), 12);
    return explicit.length ? explicit : ["אחיד"];
  };
  const ppeTotalStock = (item = {}) => Object.values(item.stockBySize || {})
    .reduce((sum, value) => sum + (Number(value) || 0), Number(item.stock || item.qty || 0) || 0);
  const ppeMinStock = (item = {}) => Number(item.minStock || item.min || item.minimum || 0) || 0;
  const ppeLine = (line = {}) => ({
    itemId: line.itemId || "",
    itemName: line.itemName || "",
    category: line.category || "",
    size: line.size || "",
    qty: Number(line.qty || 1) || 1
  });

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

  const mapTask = (task) => {
    const dueAt = Number(task.dueAt || task.due_at || 0) || null;
    const nextActionAt = Number(task.nextActionAt || task.next_action_at || 0) || null;
    const dueDays = dueAt ? daysLeft(dueAt, now) : null;
    const clean = {
      id: task.id,
      title: task.title || task.subject || "",
      status: task.status || "",
      priority: task.priority || "",
      department: task.department || task.dept || "",
      responsibleIds: cleanStringList(task.responsibleIds || task.responsible_ids),
      participantIds: cleanStringList(task.participantIds || task.participant_ids),
      ownerId: String(task.ownerId || task.owner_id || ""),
      waitingFor: task.waitingFor || task.waiting_for || "",
      category: task.category || "",
      locationText: task.locationText || task.location_text || "",
      sourceModule: task.sourceModule || task.source_module || task.origin || "",
      meetingId: task.meetingId || task.meeting_id || "",
      overdue: dueAt ? dueAt < now && isOpenTask(task) : false,
      updatedAt: task.updatedAt ? formatDateTime(task.updatedAt) : ""
    };
    if (dueDays != null) clean.dueDays = dueDays;
    if (nextActionAt) clean.nextActionAt = formatDateTime(nextActionAt);
    return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null && !(Array.isArray(value) && value.length === 0)));
  };

  const mapUser = (user) => {
    const clean = {
      id: user.id || user.authUserId || user.workerNo || "",
      workerNo: user.workerNo || user.worker_no || "",
      name: user.name || "",
      role: user.role || "",
      department: user.department || user.dept || "",
      departments: cleanStringValues(user.departments || user.depts || user.department || user.dept, 8),
      active: user.active !== false
    };
    return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null && !(Array.isArray(value) && value.length === 0)));
  };

  const mapMeeting = (meeting) => {
    const at = Number(meeting.at || meeting.meetingAt || meeting.meeting_at || 0) || null;
    const meetingDays = at ? daysLeft(at, now) : null;
    const status = String(meeting.status || "");
    const clean = {
      id: meeting.id,
      title: meeting.title || meeting.subject || "",
      type: meeting.type || "",
      status,
      department: meeting.department || meeting.dept || "",
      ownerId: String(meeting.ownerId || meeting.owner_id || ""),
      participantIds: cleanStringList(meeting.participantIds || meeting.participant_ids),
      openTaskCount: openTasks.filter((task) => task.meetingId === meeting.id || asArray(task.linkedMeetingIds).includes(meeting.id)).length,
      needsSummary: status === "planned" && at ? at < now : false
    };
    if (meetingDays != null) clean.meetingDays = meetingDays;
    return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null && !(Array.isArray(value) && value.length === 0)));
  };

  const mapPpeItem = (item) => {
    const totalStock = ppeTotalStock(item);
    const minStock = ppeMinStock(item);
    const clean = {
      id: item.id,
      name: item.name || item.itemName || "",
      category: item.category || "",
      sizes: ppeSizesForItem(item),
      totalStock,
      minStock,
      lowStock: minStock > 0 ? totalStock < minStock : false
    };
    return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null && !(Array.isArray(value) && value.length === 0)));
  };

  const mapPpeRequest = (request) => {
    const clean = {
      id: request.id,
      status: request.status || "pending",
      workerId: request.workerId || "",
      workerName: request.workerName || "",
      workerNo: request.workerNo || "",
      department: request.dept || request.department || "",
      ageDays: Math.max(0, Math.round((now - (request.at || now)) / dayMs)),
      lines: asArray(request.lines).map(ppeLine).filter((line) => line.itemId || line.itemName).slice(0, 6)
    };
    return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== "" && value != null && !(Array.isArray(value) && value.length === 0)));
  };

  const openTaskRows = openTasks
    .slice()
    .sort((a, b) => ((Number(a.dueAt || 9e15) || 9e15) - (Number(b.dueAt || 9e15) || 9e15)) || ((Number(b.updatedAt || 0) || 0) - (Number(a.updatedAt || 0) || 0)));
  const plannedMeetings = meetingList
    .filter((meeting) => String(meeting.status || "planned") === "planned")
    .slice()
    .sort((a, b) => (Number(a.at || a.meetingAt || 0) || 0) - (Number(b.at || b.meetingAt || 0) || 0));

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
      totalCost: ticketList.reduce((sum, ticket) => sum + (Number(ticket.closure?.costAmount || ticket.costAmount || ticket.cost || 0) || 0), 0),
      openTasks: openTasks.length,
      overdueTasks: openTasks.filter((task) => Number(task.dueAt || 0) && Number(task.dueAt) < now).length,
      waitingTasks: openTasks.filter((task) => task.status === "waiting").length,
      plannedMeetings: plannedMeetings.length,
      meetingsToSummarize: plannedMeetings.filter((meeting) => Number(meeting.at || meeting.meetingAt || 0) && Number(meeting.at || meeting.meetingAt) < now).length,
      ppeOpen: openPpeRequests.length,
      ppeCatalogActive: activePpeItems.length,
      ppeLowStock: activePpeItems.filter((item) => {
        const minStock = ppeMinStock(item);
        return minStock > 0 && ppeTotalStock(item) < minStock;
      }).length
    },
    bi: {
      heatmap: heatmapRows
    },
    tickets: openTickets.slice(0, maxTickets).map(mapTicket),
    fleet: fleetNearDocs.slice(0, maxFleet),
    users: userList.filter((user) => user && user.active !== false).slice(0, maxUsers).map(mapUser),
    pm: pmDue.slice(0, maxPm),
    tasks: openTaskRows.slice(0, maxTasks).map(mapTask),
    meetings: plannedMeetings.slice(0, maxMeetings).map(mapMeeting),
    suppliers,
    ppe: {
      items: activePpeItems.slice(0, maxPpeItems).map(mapPpeItem),
      requests: openPpeRequests.slice(0, maxPpeRequests).map(mapPpeRequest)
    }
  };
}
