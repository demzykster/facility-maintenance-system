import React, { useMemo, useState } from "react";
import { BIHeatmapPanel } from "./BIHeatmapPanel.jsx";
import { BIProblematicTransportPanel } from "./BIProblematicTransportPanel.jsx";
import { biHeatmapAiPrompt } from "./aiAssistEntryPointModel.js";
import { nextResponsiblePartyRows } from "./biNextResponsiblePartyModel.js";
import { BI_PERIOD_OPTIONS } from "./biScopeModel.js";
import { filterProblematicTransportRows, problematicTransportTicketRows } from "./problematicTransportTicketsModel.js";

export function BIOverview({ session, tickets, fleet, pm, zones, rounds, complaints, users, ppe, ppeItems, ppeReqs, ppeOrders, tasks, meetings, config, onOpenTicket, onGoTickets, onGoAssets, onGoCleaning, onGoPpe, onGoTasks, onAskAI, ui = {} }) {
  const {
    AlertTriangle,
    Bar,
    BarChart3,
    Building2,
    CalendarClock,
    CheckCircle2,
    ChevronLeft,
    ClipboardList,
    Clock,
    FileText,
    Gauge,
    Kpi,
    ListChecks,
    SectionTitle,
    Shirt,
    Sparkles,
    Truck,
    Wrench,
    biDepartmentRiskRows,
    biPeriodRange,
    biScopeForSession,
    biTicketHeatmapRows,
    ballHolder,
    catOf,
    countLabel,
    dayCompliance,
    daysLeft,
    docStatus,
    downtimeMs,
    fmtDate,
    fmtDur,
    fmtTime,
    ils,
    isCleaningRoundActionableStatus,
    isOpen,
    isOverdue,
    lifecycleOwnerLabel,
    needsHandler,
    normalizedTicketLifecycleStages,
    ppeIsIssue,
    ppeLow,
    ppeRequestNeedsAction,
    ppeRequestStatusLabel,
    recurringFacilityZoneRows,
    stOf,
    taskOpen,
    taskOverdue,
    ticketLifecycleWaitReasonStats,
    ticketNo,
    ticketWaitReasonLabel,
    unitLabel,
    uName,
    waitReasonLabel,
    waitReasonLifecycleMeta,
    zoneTodayStatuses
  } = ui;

  const [periodId, setPeriodId] = useState("now");
  const [expandedCommandDomain, setExpandedCommandDomain] = useState("");
  const [transportProblemExpanded, setTransportProblemExpanded] = useState(false);
  const [transportProblemFilters, setTransportProblemFilters] = useState({ period: "30", reason: "all", sort: "priority", query: "" });
  const period = biPeriodRange(periodId);
  const scope = useMemo(() => biScopeForSession(session, { tickets, fleet, pm, zones, rounds, complaints, users, ppe, ppeItems, ppeReqs, ppeOrders, tasks, meetings }), [session, tickets, fleet, pm, zones, rounds, complaints, users, ppe, ppeItems, ppeReqs, ppeOrders, tasks, meetings]);
  const isAdminBI = session?.role === "admin";
  const openTickets = scope.tickets.filter(isOpen);
  const biNow = Date.now();
  const dayMs = 86400000;
  const isTransportTicket = (ticket) => ticket.track === "transport" || (!ticket.track && ticket.forkliftId);
  const facilityOpen = openTickets.filter((ticket) => !isTransportTicket(ticket));
  const transportOpen = openTickets.filter(isTransportTicket);
  const slaBreaches = openTickets.filter(isOverdue);
  const critical = transportOpen.filter((ticket) => ticket.downtimeType === "critical");
  const waiting = openTickets.filter((ticket) => ticket.status === "waiting" || ticket.status === "pending_user" || ticket.status === "pending_admin");
  const ageBuckets = [
    { key: "today", label: "היום", min: 0, max: 1, color: "var(--primary)", focus: { maxAgeDays: 1 } },
    { key: "week", label: "2-7 ימים", min: 1, max: 7, color: "#3E6DB0", focus: { minAgeDays: 1, maxAgeDays: 7 } },
    { key: "aging", label: "8-30 ימים", min: 7, max: 30, color: "#8A6F3D", focus: { minAgeDays: 7, maxAgeDays: 30 } },
    { key: "stale", label: "מעל 30 ימים", min: 30, max: Infinity, color: "#8E2F2B", focus: { minAgeDays: 30 } }
  ].map((bucket) => {
    const items = openTickets.filter((ticket) => {
      const ageDays = Math.max(0, (biNow - (ticket.createdAt || biNow)) / dayMs);
      return ageDays >= bucket.min && ageDays < bucket.max;
    });
    return { ...bucket, value: items.length };
  });
  const maxAgeBucket = Math.max(1, ...ageBuckets.map((bucket) => bucket.value));
  const staleBuckets = [
    { key: "day", label: "מעל יום", min: 1, max: 3, color: "var(--primary)", focus: { minIdleDays: 1, maxIdleDays: 3 } },
    { key: "three", label: "3-7 ימים", min: 3, max: 7, color: "#8A6F3D", focus: { minIdleDays: 3, maxIdleDays: 7 } },
    { key: "week", label: "מעל שבוע", min: 7, max: Infinity, color: "#8E2F2B", focus: { minIdleDays: 7 } }
  ].map((bucket) => {
    const items = openTickets.filter((ticket) => {
      const idleDays = Math.max(0, (biNow - (ticket.updatedAt || ticket.createdAt || biNow)) / dayMs);
      return idleDays >= bucket.min && idleDays < bucket.max;
    });
    return { ...bucket, value: items.length };
  });
  const maxStaleBucket = Math.max(1, ...staleBuckets.map((bucket) => bucket.value));
  const pmOverdue = scope.pm.filter((task) => task.active !== false && daysLeft(task.nextDue) < 0);
  const expiringDocs = scope.fleet.map((unit) => ({ unit, status: docStatus(unit, config) })).filter((row) => row.status.d != null && row.status.d <= 30).sort((a, b) => a.status.d - b.status.d);
  const cleaningZones = scope.zones.filter((zone) => zone.active !== false);
  const cleaningNow = Date.now();
  const cleaningToday = cleaningZones.flatMap((zone) => zoneTodayStatuses(zone, scope.rounds, cleaningNow, config).map((status) => ({ zone, ...status })));
  const cleaningMissed = cleaningToday.filter((row) => row.status === "missed");
  const cleaningDue = cleaningToday.filter((row) => isCleaningRoundActionableStatus(row.status));
  const cleaningOpen = scope.complaints.filter((complaint) => complaint.status === "open" || complaint.status === "pending");
  const cleaningIssueRounds = scope.rounds.filter((round) => (round.at || 0) >= period.trendStart && (round.issues || []).length > 0);
  const ppeLowItems = scope.ppeItems.filter((item) => item.active !== false && ppeLow(item));
  const ppePending = scope.ppeReqs.filter(ppeRequestNeedsAction);
  const ppeOpenOrders = scope.ppeOrders.filter((order) => order.status === "draft" || order.status === "sent");
  const createdInTrend = scope.tickets.filter((ticket) => (ticket.createdAt || 0) >= period.trendStart);
  const createdPrevTrend = scope.tickets.filter((ticket) => (ticket.createdAt || 0) >= period.previousTrendStart && (ticket.createdAt || 0) < period.trendStart);
  const closedInTrend = scope.tickets.filter((ticket) => !isOpen(ticket) && (ticket.closure?.signedAt || ticket.updatedAt || 0) >= period.trendStart);
  const trendDelta = createdInTrend.length - createdPrevTrend.length;
  const repeatProblemRows = Object.values(scope.tickets.filter((ticket) => (ticket.createdAt || 0) >= period.evidenceStart).reduce((acc, ticket) => {
    const category = catOf(ticket);
    const repeatFocus = ticket.forkliftId
      ? { forkliftId: ticket.forkliftId }
      : ticket.asset
        ? { assetKey: ticket.asset }
        : ticket.zone
          ? { zoneKey: ticket.zone }
          : { categoryId: category.id };
    const key = ticket.forkliftId ? `fleet:${ticket.forkliftId}` : ticket.asset ? `asset:${ticket.asset}` : ticket.zone ? `zone:${ticket.zone}` : `cat:${category.id}`;
    const label = ticket.forkliftId ? unitLabel(scope.fleet.find((unit) => unit.id === ticket.forkliftId), config) : (ticket.asset || ticket.zone || category.label || "כללי");
    acc[key] = acc[key] || { key, label, focus: repeatFocus, n: 0, open: 0, track: isTransportTicket(ticket) ? "transport" : "facility" };
    acc[key].n += 1;
    if (isOpen(ticket)) acc[key].open += 1;
    return acc;
  }, {})).filter((row) => row.n >= 2).sort((a, b) => b.open - a.open || b.n - a.n).slice(0, 4);
  const maxRepeatN = Math.max(1, ...repeatProblemRows.map((row) => row.n));
  const departmentRiskRows = biDepartmentRiskRows({
    departments: scope.kind === "company" ? (config.departments || []) : scope.departments,
    tickets: scope.tickets,
    fleet: scope.fleet,
    pm: scope.pm,
    zones: scope.zones,
    complaints: scope.complaints,
    ppeReqs: scope.ppeReqs
  }, {
    isOpenTicket: isOpen,
    isOverdueTicket: isOverdue,
    pmIsOverdue: (task) => task.active !== false && daysLeft(task.nextDue) < 0,
    ppeRequestNeedsAction
  });
  const ticketHeatmapRows = biTicketHeatmapRows({
    departments: scope.kind === "company" ? (config.departments || []) : scope.departments,
    tickets: scope.tickets,
    fleet: scope.fleet,
    zones: scope.zones
  }, {
    now: biNow,
    isOpenTicket: isOpen,
    isOverdueTicket: isOverdue,
    maxRows: scope.kind === "company" ? 8 : 6
  });
  const ticketHeatmapMax = Math.max(1, ...ticketHeatmapRows.flatMap((row) => row.cells.map((cell) => cell.value)));
  const problematicTransportAllRows = problematicTransportTicketRows(scope.tickets, {
    fleet: scope.fleet,
    zones: scope.zones,
    allowedFleetIds: scope.kind === "department" ? scope.fleet.map((unit) => unit.id) : undefined,
    now: biNow
  });
  const problematicTransportRows = problematicTransportAllRows.slice(0, scope.kind === "company" ? 8 : 6);
  const filteredProblematicTransportRows = filterProblematicTransportRows(problematicTransportAllRows, {
    ...transportProblemFilters,
    now: biNow
  });
  const nextResponsibleRows = nextResponsiblePartyRows(openTickets, {
    fleet: scope.fleet,
    users: scope.users,
    waitReasonMeta: (id) => waitReasonLifecycleMeta(config, id),
    maxRows: scope.kind === "company" ? 8 : 6
  });
  const maxNextResponsible = Math.max(1, ...nextResponsibleRows.map((row) => row.n));
  const closedInEvidence = scope.canViewFinancialBI ? scope.tickets.filter((ticket) => ticket.closure && (ticket.closure.signedAt || 0) >= period.evidenceStart) : [];
  const periodCost = closedInEvidence.reduce((sum, ticket) => sum + (ticket.closure.costAmount || 0), 0);
  const avgClosedCost = closedInEvidence.length ? Math.round(periodCost / closedInEvidence.length) : 0;
  const supplierCostRows = Object.entries(closedInEvidence.reduce((acc, ticket) => {
    const supplier = ticket.closure?.costSupplier || "ללא ספק";
    acc[supplier] = (acc[supplier] || 0) + (ticket.closure?.costAmount || 0);
    return acc;
  }, {})).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const maxSupplierCost = Math.max(1, ...supplierCostRows.map(([, value]) => value));
  const categoryCostRows = Object.entries(closedInEvidence.reduce((acc, ticket) => {
    const category = catOf(ticket).label || "כללי";
    acc[category] = (acc[category] || 0) + (ticket.closure?.costAmount || 0);
    return acc;
  }, {})).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const maxCategoryCost = Math.max(1, ...categoryCostRows.map(([, value]) => value));
  const assetCostRows = Object.entries(closedInEvidence.reduce((acc, ticket) => {
    const asset = ticket.forkliftId ? unitLabel(scope.fleet.find((unit) => unit.id === ticket.forkliftId), config) : (ticket.asset || ticket.zone || "ללא נכס");
    acc[asset] = (acc[asset] || 0) + (ticket.closure?.costAmount || 0);
    return acc;
  }, {})).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const maxAssetCost = Math.max(1, ...assetCostRows.map(([, value]) => value));
  const lifecycleOptions = {
    now: Date.now(),
    isOpen,
    statusLabel: (id) => stOf(id).label,
    waitReasonLabel: (id) => waitReasonLabel(id, config),
    waitReasonMeta: (id) => waitReasonLifecycleMeta(config, id)
  };
  const lifecycleStageRows = openTickets.flatMap((ticket) => normalizedTicketLifecycleStages(ticket, lifecycleOptions)).filter((stage) => stage.current || stage.kind === "rework");
  const lifecycleStageMap = {};
  lifecycleStageRows.forEach((stage) => {
    const row = lifecycleStageMap[stage.key] || { ...stage, n: 0, ms: 0 };
    row.n += 1;
    row.ms += stage.ms || 0;
    lifecycleStageMap[stage.key] = row;
  });
  const lifecycleBottlenecks = Object.values(lifecycleStageMap).sort((a, b) => b.n - a.n || b.ms - a.ms).slice(0, 4);
  const waitReasonRows = ticketLifecycleWaitReasonStats(openTickets, lifecycleOptions).slice(0, 4);
  const maxLifecycleN = Math.max(1, ...lifecycleBottlenecks.map((row) => row.n));
  const visibleWaitReasonRows = waitReasonRows.filter((row) => !lifecycleBottlenecks.some((stage) => stage.key === `waiting:${row.reason}`));
  const maxWaitReasonN = Math.max(1, ...visibleWaitReasonRows.map((row) => row.n));
  const ticketDomain = (ticket) => isTransportTicket(ticket) ? "שינוע" : "מבנה";
  const ticketCause = (ticket, fallback) => ticketWaitReasonLabel(ticket, config) || ballHolder(ticket)?.label || fallback || stOf(ticket.status).label;
  const ticketTitle = (ticket) => `${ticketNo(ticket)} · ${ticket.subject || ticket.asset || "קריאה"}`;
  const downtimeRows = critical.map((ticket) => {
    const stages = normalizedTicketLifecycleStages(ticket, lifecycleOptions)
      .filter((stage) => stage.countsDowntime || stage.current || stage.kind === "waiting")
      .sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || (b.ms || 0) - (a.ms || 0));
    const mainStage = stages[0] || null;
    const downtime = downtimeMs(ticket);
    return {
      ticket,
      downtime,
      stage: mainStage,
      cause: ticketCause(ticket, mainStage?.label || "בדיקת טיפול")
    };
  }).sort((a, b) => b.downtime - a.downtime).slice(0, 3);
  const unownedTickets = openTickets.filter((ticket) => needsHandler(ticket, scope.users, scope.fleet));
  const topAttention = [
    ...slaBreaches.map((ticket) => ({ ticket, label: "חריגת SLA", color: "#B91C1C" })),
    ...critical.filter((ticket) => !slaBreaches.some((item) => item.id === ticket.id)).map((ticket) => ({ ticket, label: "השבתה קריטית", color: "#C2410C" })),
    ...waiting.filter((ticket) => !slaBreaches.some((item) => item.id === ticket.id) && !critical.some((item) => item.id === ticket.id)).map((ticket) => ({ ticket, label: "ממתין לגורם", color: "#B45309" }))
  ].slice(0, 6);
  const rawCommandItems = isAdminBI ? [
    ...unownedTickets.map((ticket) => ({ key: `owner-${ticket.id}`, domain: ticketDomain(ticket), title: ticketTitle(ticket), sub: `${ticketCause(ticket, "אין בעלים פעיל")} · נדרש שיבוץ`, nextStep: "להחליט מי בעל הטיפול הבא", actionLabel: "פתח קריאה", color: "#7F1D1D", action: () => onOpenTicket?.(ticket.id) })),
    ...slaBreaches.map((ticket) => ({ key: `sla-${ticket.id}`, domain: ticketDomain(ticket), title: ticketTitle(ticket), sub: `חריגת SLA · ${ticketCause(ticket, "בדיקת סטטוס")}`, nextStep: "לבדוק חסם ולהחזיר למסלול", actionLabel: "פתח קריאה", color: "#B91C1C", action: () => onOpenTicket?.(ticket.id) })),
    ...critical.map((ticket) => ({ key: `critical-${ticket.id}`, domain: "שינוע", title: ticketTitle(ticket), sub: `השבתה קריטית · ${ticketCause(ticket, "בדיקת טיפול")}`, nextStep: "לוודא חלופה או החזרה לשירות", actionLabel: "פתח קריאה", color: "#C2410C", action: () => onOpenTicket?.(ticket.id) })),
    ...cleaningOpen.map((complaint) => ({ key: `clean-${complaint.id}`, domain: "ניקיון", title: complaint.zoneName || "אזור ניקיון", sub: `${complaint.status === "pending" ? "דיווח ממתין לאישור" : "דיווח פתוח"} · ${complaint.kind === "broken" ? "תקלה" : "לכלוך"}`, nextStep: complaint.status === "pending" ? "לאשר או לדחות את הדיווח" : "להשלים טיפול באזור", actionLabel: "לניקיון", color: "#B45309", action: onGoCleaning })),
    ...cleaningMissed.map((row) => ({ key: `clean-missed-${row.zone.id}-${row.win?.id || row.win?.time || "win"}`, domain: "ניקיון", title: row.zone.name || "אזור ניקיון", sub: `סבב ניקיון פוספס · ${row.win?.time || "היום"}`, nextStep: "לשבץ כיסוי או לבדוק היעדרות", actionLabel: "לניקיון", color: "#B91C1C", action: onGoCleaning })),
    ...ppePending.map((request) => ({ key: `ppe-${request.id}`, domain: "ביגוד", title: request.workerName || "בקשת ביגוד", sub: `${ppeRequestStatusLabel(request.status)} · ${(request.lines || []).length || 1} פריטים`, nextStep: "לאשר, להכין או להעביר לחתימה", actionLabel: "לביגוד", color: "#0D9488", action: onGoPpe })),
    ...pmOverdue.map((task) => ({ key: `pm-${task.id}`, domain: "PM", title: task.name || task.title || task.fleetCode || "טיפול תקופתי", sub: "באיחור · לפתוח צי ותחזוקה מונעת", nextStep: "לתאם הוצאת כלי לטיפול", actionLabel: "ל-PM", color: "#B45309", action: () => onGoAssets?.({ tab: "pm" }) })),
    ...expiringDocs.filter((row) => row.status.d < 0).map(({ unit, status }) => ({ key: `doc-${unit.id}-${status.label}`, domain: "מסמכים", title: unitLabel(unit, config), sub: `${status.label} · פג תוקף`, nextStep: "לעדכן מסמך או להשבית שימוש", actionLabel: "לכלי", color: "#B45309", action: () => onGoAssets?.({ tab: "fleet" }) })),
  ] : [];
  const commandSeen = new Set();
  const commandItems = rawCommandItems.filter((item) => {
    if (commandSeen.has(item.key)) return false;
    commandSeen.add(item.key);
    return true;
  });
  const commandDomainCounts = commandItems.reduce((acc, item) => ({ ...acc, [item.domain]: (acc[item.domain] || 0) + 1 }), {});
  const firstByDomain = Object.keys(commandDomainCounts).map((domain) => commandItems.find((item) => item.domain === domain)).filter(Boolean);
  const commandQueue = [...firstByDomain, ...commandItems.filter((item) => !firstByDomain.some((first) => first.key === item.key))].slice(0, 8);
  const commandDomainMeta = {
    "מבנה": { Icon: Building2, color: "#1F4E8C" },
    "שינוע": { Icon: Truck, color: "#B45309" },
    "ניקיון": { Icon: Sparkles, color: "#0D9488" },
    "ביגוד": { Icon: Shirt, color: "#475569" },
    "PM": { Icon: CalendarClock, color: "#B45309" },
    "מסמכים": { Icon: FileText, color: "#64748B" }
  };
  const commandDomainGroups = Object.entries(commandDomainCounts).map(([domain, count]) => ({
    domain,
    count,
    items: commandItems.filter((item) => item.domain === domain),
    ...(commandDomainMeta[domain] || { Icon: ClipboardList, color: "var(--primary)" })
  }));
  const activeCommandDomain = commandDomainGroups.some((group) => group.domain === expandedCommandDomain) ? expandedCommandDomain : expandedCommandDomain === "__none" ? "" : commandDomainGroups[0]?.domain;
  const scopeTitle = scope.kind === "company" ? "תמונת חברה" : scope.departments.length ? `מחלקות: ${scope.departments.join(", ")}` : "לא הוגדר scope";
  const openTasks = scope.tasks.filter(taskOpen);
  const overdueTasks = openTasks.filter(taskOverdue);
  const upcomingMeetings = scope.meetings.filter((meeting) => meeting.status === "planned" && (meeting.at || 0) >= biNow && (meeting.at || 0) <= biNow + period.trendDays * dayMs).sort((a, b) => (a.at || 0) - (b.at || 0));
  const riskRowAction = (row) => {
    if (row.openTickets) return () => onGoTickets?.({ st: "open", focus: { label: `BI · מחלקה · ${row.name}`, department: row.name } });
    if (row.pmOverdue) return () => onGoAssets?.({ tab: "pm" });
    if (row.cleaningOpen) return onGoCleaning || null;
    if (row.ppePending) return onGoPpe || null;
    return null;
  };
  const facilityInEvidence = scope.tickets.filter((ticket) => !isTransportTicket(ticket) && (ticket.createdAt || 0) >= period.evidenceStart);
  const facilityCategoryRows = Object.values(facilityInEvidence.reduce((acc, ticket) => {
    const category = catOf(ticket);
    const key = category.id || "other";
    const row = acc[key] || { key, categoryId: category.id, label: category.label || "כללי", n: 0, open: 0 };
    row.n += 1;
    if (isOpen(ticket)) row.open += 1;
    acc[key] = row;
    return acc;
  }, {})).sort((a, b) => b.open - a.open || b.n - a.n).slice(0, 4);
  const facilityZoneRows = recurringFacilityZoneRows(facilityInEvidence, { isOpenTicket: isOpen }).slice(0, 3);
  const maxFacilityCategory = Math.max(1, ...facilityCategoryRows.map((row) => row.n));
  const maxFacilityZone = Math.max(1, ...facilityZoneRows.map((row) => row.n));
  const techLoadRows = Object.values(openTickets.filter((ticket) => ticket.assignee).reduce((acc, ticket) => {
    const key = ticket.assignee;
    const row = acc[key] || { key, label: ticket.assignee, n: 0, overdue: 0, critical: 0 };
    row.n += 1;
    if (isOverdue(ticket)) row.overdue += 1;
    if (ticket.downtimeType === "critical") row.critical += 1;
    acc[key] = row;
    return acc;
  }, {})).sort((a, b) => b.overdue - a.overdue || b.critical - a.critical || b.n - a.n).slice(0, 4);
  const maxTechLoad = Math.max(1, ...techLoadRows.map((row) => row.n));
  const pmHistoryInEvidence = scope.pm.flatMap((task) => (task.history || []).map((entry) => ({ task, entry }))).filter(({ entry }) => (entry.at || 0) >= period.evidenceStart);
  const pmDoneInEvidence = pmHistoryInEvidence.filter(({ entry }) => entry.type !== "missed");
  const pmMissedInEvidence = pmHistoryInEvidence.filter(({ entry }) => entry.type === "missed");
  const pmCompletionRate = pmHistoryInEvidence.length ? Math.round(pmDoneInEvidence.length / pmHistoryInEvidence.length * 100) : null;
  const cleaningWindowStats = cleaningZones.reduce((acc, zone) => {
    for (let i = 0; i < period.trendDays; i += 1) {
      dayCompliance(zone, scope.rounds, biNow - i * dayMs, biNow).forEach((row) => {
        acc.total += 1;
        if (row.ok) acc.ok += 1;
      });
    }
    return acc;
  }, { total: 0, ok: 0 });
  const cleaningCompliance = cleaningWindowStats.total ? Math.round(cleaningWindowStats.ok / cleaningWindowStats.total * 100) : null;
  const ppeIssuedInEvidence = scope.ppe.filter((entry) => ppeIsIssue(entry) && (entry.at || 0) >= period.evidenceStart);
  const ppeCostInEvidence = ppeIssuedInEvidence.reduce((sum, entry) => {
    const item = scope.ppeItems.find((candidate) => candidate.id === entry.itemId);
    return sum + (entry.workerCharge || ((item?.unitCost || 0) * Math.max(1, entry.qty || 1)) || 0);
  }, 0);
  const ppeRepeatWorkers = Object.values(ppeIssuedInEvidence.reduce((acc, entry) => {
    const key = entry.workerId || entry.workerName || "unknown";
    const row = acc[key] || { key, label: entry.workerName || uName(entry.workerId, scope.users) || "עובד", n: 0 };
    row.n += 1;
    acc[key] = row;
    return acc;
  }, {})).filter((row) => row.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3);

  if (scope.kind === "none") return <Empty text="אין הרשאת BI" Icon={Gauge} sub="המודול פתוח בשלב הראשון להנהלה, מנהלי מערכת ומנהלי מחלקות." />;

  return <div className="bi-shell">
    <div className="bi-hero">
      <div>
        <div className="bi-kicker">BI · {scopeTitle}</div>
        <h2>מה דורש תשומת לב עכשיו</h2>
        <p>תמונה ניהולית קצרה לתקופה שנבחרה, עם אפשרות להיכנס לפרטים דרך המודולים הקיימים.</p>
      </div>
      <div className="bi-period-switch" role="group" aria-label="תקופת BI">
        {BI_PERIOD_OPTIONS.map((option) => <button key={option.id} type="button" className={period.id === option.id ? "on" : ""} onClick={() => setPeriodId(option.id)}>{option.label}</button>)}
      </div>
    </div>

    <div className="kpi-grid bi-kpis">
      <Kpi num={openTickets.length} label="קריאות פתוחות" color="var(--primary)" small />
      <Kpi num={slaBreaches.length} label="חריגות SLA" color={slaBreaches.length ? "#B91C1C" : "#64748B"} small />
      <Kpi num={critical.length} label="השבתות שינוע" color={critical.length ? "#C2410C" : "#64748B"} small />
      <Kpi num={pmOverdue.length} label="טיפולים באיחור" color={pmOverdue.length ? "#B45309" : "#64748B"} small />
      {scope.canViewFinancialBI && <Kpi num={ils(periodCost)} label={`עלות ${period.evidenceDays} ימים`} color="#0D9488" small />}
    </div>

    <div className="bi-grid">
      <BIHeatmapPanel
        rows={ticketHeatmapRows}
        max={ticketHeatmapMax}
        onOpenAll={() => onGoTickets?.({ st: "open", focus: { label: "BI · מפת חום קריאות" } })}
        onOpenDepartment={(row) => onGoTickets?.({ st: "open", focus: { label: `BI · מפת חום · ${row.name}`, department: row.name } })}
        onOpenCell={(row, cell) => onGoTickets?.({ st: "open", focus: { label: `BI · ${row.name} · ${cell.label}`, department: row.name, heatmapMetric: cell.key } })}
        onAskAI={onAskAI ? ({ rows, row, cell }) => onAskAI(biHeatmapAiPrompt({ rows, row, cell })) : null}
      />

      {isAdminBI && <section className="panel bi-panel bi-command-panel">
        <div className="bi-panel-head"><div><b>דורש החלטה עכשיו</b><span>{commandQueue.length ? `${commandQueue.length} פריטים ראשונים מכל המודולים` : "אין כרגע פריטים דחופים"}</span></div></div>
        {commandDomainGroups.length ? <div className="bi-command-stack">
          <div className="bi-command-domains">
            {commandDomainGroups.map(({ domain, count, Icon, color }) => {
              const open = activeCommandDomain === domain;
              return <button key={domain} type="button" className={"bi-command-domain" + (open ? " on" : "")} aria-expanded={open} onClick={() => setExpandedCommandDomain(open ? "__none" : domain)}>
                <span className="bi-command-domain-icon" style={{ color }}><Icon size={18} /></span>
                <span className="bi-command-domain-text"><span>{domain}</span><small>{count} לטיפול</small></span>
                <span className="bi-command-domain-count">{count}</span>
                <ChevronLeft size={15} className="bi-command-domain-chev" />
              </button>;
            })}
          </div>
          {commandDomainGroups.map((group) => activeCommandDomain === group.domain ? <div key={group.domain} className="bi-command-list" aria-label={`פריטי ${group.domain}`}>
            {group.items.map((item) => <button key={item.key} className="bi-attn-row" onClick={item.action || undefined} disabled={!item.action}>
              <span className="bi-dot" style={{ background: item.color }} />
              <span><span className="bi-command-meta">{item.actionLabel && <small>{item.actionLabel}</small>}</span><b>{item.title}</b><small>{item.sub}</small>{item.nextStep && <small className="bi-command-next">המשך: {item.nextStep}</small>}</span>
              {item.action && <ChevronLeft size={15} />}
            </button>)}
          </div> : null)}
        </div> : <div className="note">אין כרגע החלטות דחופות. המשיכו לעקוב אחרי המדדים והמודולים.</div>}
      </section>}

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>דורש טיפול</b><span>{topAttention.length ? `${topAttention.length} פריטים ראשונים` : "אין חריגים פתוחים"}</span></div><button className="btn-ghost sm" onClick={() => onGoTickets?.({ st: "open", focus: { label: "BI · דורש טיפול" } })}>לכל הקריאות</button></div>
        {topAttention.length ? topAttention.map(({ ticket, label, color }) => <button key={ticket.id} className="bi-attn-row" onClick={() => onOpenTicket?.(ticket.id)}>
          <span className="bi-dot" style={{ background: color }} />
          <span><b>{ticketNo(ticket)} · {ticket.subject || ticket.asset || "קריאה"}</b><small>{label} · {stOf(ticket.status).label}</small></span>
          <ChevronLeft size={15} />
        </button>) : <div className="note">אין כרגע חריגות מרכזיות בתחום הזה.</div>}
      </section>

      <BIProblematicTransportPanel
        rows={problematicTransportRows}
        allRows={problematicTransportAllRows}
        filteredRows={filteredProblematicTransportRows}
        expanded={transportProblemExpanded}
        filters={transportProblemFilters}
        onToggleExpanded={setTransportProblemExpanded}
        onFilterChange={setTransportProblemFilters}
        onOpenTicket={onOpenTicket}
        ticketNo={ticketNo}
        statusLabel={(status) => stOf(status).label}
        unitLabel={(unit) => unitLabel(unit, config)}
        formatDuration={fmtDur}
        formatCost={ils}
        formatDate={fmtDate}
      />

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>אצל מי השלב הבא</b><span>{nextResponsibleRows.length ? `${nextResponsibleRows.length} גורמים עם קריאות פתוחות` : "אין כרגע קריאות פתוחות לשיוך"}</span></div></div>
        {nextResponsibleRows.length ? nextResponsibleRows.map((row) => <Bar
          key={row.key}
          label={row.label}
          value={row.n}
          max={maxNextResponsible}
          suffix={row.description ? ` · ${row.description}` : ""}
          color={row.type === "unclear" ? "#B91C1C" : row.type === "transport_supplier_queue" ? "#B45309" : row.type.startsWith("waiting") ? "#D97706" : "var(--primary)"}
          onClick={() => onGoTickets?.({ st: "open", focus: { label: `BI · השלב הבא · ${row.label}`, nextResponsiblePartyKey: row.key } })}
        />) : <div className="note">אין כרגע גורם הבא להצגה.</div>}
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>סיבות עומס</b><span>מה מסביר את מצב הקריאות</span></div></div>
        <Bar label="קריאות מבנה פתוחות" value={facilityOpen.length} max={Math.max(openTickets.length, 1)} color="var(--primary)" onClick={() => onGoTickets?.({ st: "open", track: "facility", focus: { label: "BI · קריאות מבנה פתוחות" } })} />
        <Bar label="קריאות שינוע פתוחות" value={transportOpen.length} max={Math.max(openTickets.length, 1)} color="var(--primary)" onClick={() => onGoTickets?.({ st: "open", track: "transport", focus: { label: "BI · קריאות שינוע פתוחות" } })} />
        <Bar label="ממתין לגורם או אישור" value={waiting.length} max={Math.max(openTickets.length, 1)} color="#B45309" onClick={() => onGoTickets?.({ st: "open", focus: { label: "BI · ממתין לגורם או אישור", statuses: ["waiting", "pending_user", "pending_admin"] } })} />
        <Bar label="חריגות SLA" value={slaBreaches.length} max={Math.max(openTickets.length, 1)} color="#B91C1C" onClick={() => onGoTickets?.({ st: "open", focus: { label: "BI · חריגות SLA", overdue: true } })} />
        <Bar label="השבתה קריטית" value={critical.length} max={Math.max(openTickets.length, 1)} color="#C2410C" onClick={() => onGoTickets?.({ st: "open", track: "transport", focus: { label: "BI · השבתה קריטית", activeCriticalTransport: true } })} />
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>גיל הקריאות</b><span>האם העבודה חדשה או הופכת לחוב פתוח</span></div></div>
        {ageBuckets.map((bucket) => <Bar key={bucket.key} label={bucket.label} value={bucket.value} max={maxAgeBucket} color={bucket.color} onClick={() => onGoTickets?.({ st: "open", focus: { label: `BI · גיל קריאות · ${bucket.label}`, ...bucket.focus } })} />)}
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>קריאות ללא תנועה</b><span>פתוחות שלא עודכנו לאחרונה</span></div></div>
        {staleBuckets.map((bucket) => <Bar key={bucket.key} label={bucket.label} value={bucket.value} max={maxStaleBucket} color={bucket.color} onClick={() => onGoTickets?.({ st: "open", focus: { label: `BI · ללא תנועה · ${bucket.label}`, ...bucket.focus } })} />)}
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>למה זה תקוע</b><span>צווארי בקבוק וסיבות המתנה מתוך הקריאות הפתוחות</span></div></div>
        {lifecycleBottlenecks.length > 0 && <div className="bi-subtitle">שלבים פעילים</div>}
        {lifecycleBottlenecks.length ? lifecycleBottlenecks.map((stage) => <Bar key={stage.key} label={stage.label} value={stage.n} max={maxLifecycleN} suffix={stage.ms ? ` · ${fmtDur(stage.ms)} · ${lifecycleOwnerLabel(stage.owner)}` : ` · ${lifecycleOwnerLabel(stage.owner)}`} color={stage.kind === "waiting" ? "#B45309" : stage.kind === "rework" ? "#B91C1C" : "var(--primary)"} onClick={() => onGoTickets?.({ st: "open", focus: { label: `BI · שלב · ${stage.label}`, lifecycleKey: stage.key } })} />) : <div className="note">אין כרגע צווארי בקבוק פתוחים.</div>}
        {visibleWaitReasonRows.length > 0 && <div className="bi-subdivider" />}
        {visibleWaitReasonRows.length > 0 && <div className="bi-subtitle">סיבות המתנה</div>}
        {visibleWaitReasonRows.map((row) => <Bar key={row.reason} label={row.label} value={row.n} max={maxWaitReasonN} suffix={row.ms ? ` · ${fmtDur(row.ms)}` : ""} color="#B45309" onClick={() => onGoTickets?.({ st: "open", focus: { label: `BI · סיבת המתנה · ${row.label}`, lifecycleKey: `waiting:${row.reason}` } })} />)}
        {downtimeRows.length > 0 && <div className="bi-subdivider" />}
        {downtimeRows.length > 0 && <div className="bi-subtitle">השבתות מוסברות</div>}
        {downtimeRows.map((row) => <button key={row.ticket.id} className="bi-doc-row bi-doc-action" onClick={() => onOpenTicket?.(row.ticket.id)}>
          <b>{ticketTitle(row.ticket)}</b>
          <span>{fmtDur(row.downtime)} · {row.cause}{row.stage?.label ? ` · שלב מרכזי: ${row.stage.label}` : ""}</span>
        </button>)}
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>מגמות קצרות</b><span>מה השתנה בשבוע האחרון ומה חוזר על עצמו</span></div></div>
        <div className="bi-mini-stats">
          <span><b>{createdInTrend.length}</b><small>נפתחו {period.trendDays} ימים</small></span>
          <span><b>{closedInTrend.length}</b><small>נסגרו {period.trendDays} ימים</small></span>
          <span><b>{trendDelta > 0 ? `+${trendDelta}` : trendDelta}</b><small>מול תקופה קודמת</small></span>
        </div>
        {repeatProblemRows.length > 0 && <div className="bi-subtitle">חזרתיות ב-{period.evidenceDays} ימים</div>}
        {repeatProblemRows.length ? repeatProblemRows.map((row) => <Bar key={row.key} label={row.label} value={row.n} max={maxRepeatN} suffix={row.open ? ` · ${row.open} פתוחות` : ""} color={row.open ? "#B45309" : "var(--primary)"} onClick={() => onGoTickets?.({ st: "all", track: row.track, focus: { label: `BI · חזרתיות · ${row.label}`, ...row.focus } })} />) : <div className="note" style={{ marginTop: 10 }}>אין כרגע דפוס חזרתי בולט ב-{period.evidenceDays} הימים האחרונים.</div>}
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>{scope.kind === "company" ? "אזורי סיכון" : "המחלקות שלי"}</b><span>איפה מצטברת עבודה שדורשת תשומת לב</span></div></div>
        {departmentRiskRows.length ? departmentRiskRows.slice(0, 5).map((row) => {
          const action = riskRowAction(row);
          return <button key={row.name} className="bi-risk-row" onClick={action || undefined} disabled={!action}>
            <span><b>{row.name}</b><small>{row.openTickets ? `${countLabel(row.openTickets, "קריאה פתוחה", "קריאות פתוחות")}` : "ללא קריאות פתוחות"}</small></span>
            <span className="bi-risk-tags">
              {row.slaBreaches > 0 && <em>‏SLA {row.slaBreaches}</em>}
              {row.criticalDowntime > 0 && <em>השבתה {row.criticalDowntime}</em>}
              {row.pmOverdue > 0 && <em>PM {row.pmOverdue}</em>}
              {row.cleaningOpen > 0 && <em>ניקיון {row.cleaningOpen}</em>}
              {row.ppePending > 0 && <em>ביגוד {row.ppePending}</em>}
            </span>
            {action && <ChevronLeft size={15} />}
          </button>;
        }) : <div className="note">אין כרגע מוקדי עומס לפי מחלקות.</div>}
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>צי ותחזוקה מונעת</b><span>מסמכים וטיפולים שיכולים להפוך לבעיה</span></div><button className="btn-ghost sm" onClick={() => onGoAssets?.({ tab: "fleet" })}>לכלים</button></div>
        <div className="bi-mini-stats">
          <span><b>{scope.fleet.length}</b><small>כלים בתחום</small></span>
          <span><b>{expiringDocs.length}</b><small>מסמכים קרובים/פגי תוקף</small></span>
          <span><b>{pmOverdue.length}</b><small>PM באיחור</small></span>
        </div>
        {expiringDocs.slice(0, 3).map(({ unit, status }) => <div key={unit.id} className="bi-doc-row"><b>{unitLabel(unit, config)}</b><span>{status.label} · {status.d < 0 ? "פג תוקף" : `בעוד ${status.d} ימים`}</span></div>)}
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>אחזקת מבנה</b><span>קטגוריות ואזורים שמסבירים את העומס</span></div><button className="btn-ghost sm" onClick={() => onGoTickets?.({ st: "all", track: "facility", focus: { label: "BI · אחזקת מבנה" } })}>לקריאות</button></div>
        {facilityCategoryRows.length ? facilityCategoryRows.map((row) => <Bar key={row.key} label={row.label} value={row.n} max={maxFacilityCategory} suffix={row.open ? ` · ${row.open} פתוחות` : ""} color={row.open ? "#B45309" : "var(--primary)"} onClick={() => onGoTickets?.({ st: "all", track: "facility", focus: { label: `BI · מבנה · ${row.label}`, categoryId: row.categoryId } })} />) : <div className="note">אין עומס מבנה משמעותי ב-{period.evidenceDays} הימים האחרונים.</div>}
        {facilityZoneRows.length > 0 && <div className="bi-subdivider" />}
        {facilityZoneRows.length > 0 && <div className="bi-subtitle">אזורים חוזרים</div>}
        {facilityZoneRows.map((row) => <Bar key={row.key} label={row.label} value={row.n} max={maxFacilityZone} suffix={row.open ? ` · ${row.open} פתוחות` : ""} color={row.open ? "#B45309" : "var(--primary)"} onClick={() => onGoTickets?.({ st: "all", track: "facility", focus: { label: `BI · אזור · ${row.label}`, zoneKey: row.key } })} />)}
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>עומס ביצוע</b><span>טכנאים ו-PM בלי להיכנס לדוח מלא</span></div></div>
        <div className="bi-mini-stats">
          <span><b>{techLoadRows.length}</b><small>מטפלים פעילים</small></span>
          <span><b>{pmCompletionRate == null ? "—" : `${pmCompletionRate}%`}</b><small>ביצוע PM {period.evidenceDays} ימים</small></span>
          <span><b>{pmMissedInEvidence.length}</b><small>PM שלא הגיעו</small></span>
        </div>
        {techLoadRows.length ? techLoadRows.map((row) => <Bar key={row.key} label={row.label} value={row.n} max={maxTechLoad} suffix={`${row.overdue ? ` · SLA ${row.overdue}` : ""}${row.critical ? ` · השבתה ${row.critical}` : ""}`} color={row.overdue ? "#B91C1C" : row.critical ? "#C2410C" : "var(--primary)"} onClick={() => onGoTickets?.({ st: "open", focus: { label: `BI · עומס · ${row.label}`, assignee: row.key } })} />) : <div className="note" style={{ marginTop: 10 }}>אין עומס חריג לפי מטפל.</div>}
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>ניקיון</b><span>סבבים ודיווחים לפי אזורי האחריות</span></div>{onGoCleaning && <button className="btn-ghost sm" onClick={onGoCleaning}>לניקיון</button>}</div>
        <div className="bi-mini-stats">
          <span><b>{cleaningZones.length}</b><small>אזורי ניקיון</small></span>
          <span><b>{cleaningOpen.length}</b><small>דיווחים פתוחים</small></span>
          <span><b>{cleaningCompliance == null ? "—" : `${cleaningCompliance}%`}</b><small>עמידה {period.trendDays} ימים</small></span>
        </div>
        {cleaningOpen.slice(0, 2).map((complaint) => <div key={complaint.id} className="bi-doc-row"><b>{complaint.zoneName || "אזור ניקיון"}</b><span>{complaint.status === "pending" ? "ממתין לאישור" : "פתוח"} · {complaint.kind === "broken" ? "תקלה" : "לכלוך"}</span></div>)}
        {!cleaningOpen.length && cleaningDue.length > 0 && <div className="bi-doc-row"><b>{cleaningDue[0].zone.name}</b><span>לביצוע עכשיו · {cleaningDue[0].win?.time || "חלון ניקיון"}</span></div>}
        {!cleaningOpen.length && !cleaningDue.length && cleaningIssueRounds.length > 0 && <div className="bi-doc-row"><b>סבבים עם הערות</b><span>{cleaningIssueRounds.length} ב-{period.trendDays} ימים</span></div>}
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>ביגוד וציוד מגן</b><span>בקשות, מלאי נמוך והזמנות פתוחות</span></div>{onGoPpe && <button className="btn-ghost sm" onClick={onGoPpe}>לביגוד</button>}</div>
        <div className="bi-mini-stats">
          <span><b>{ppePending.length}</b><small>בקשות לטיפול</small></span>
          <span><b>{ppeLowItems.length}</b><small>פריטים במלאי נמוך</small></span>
          <span><b>{scope.canViewFinancialBI ? ils(ppeCostInEvidence) : ppeIssuedInEvidence.length}</b><small>{scope.canViewFinancialBI ? `עלות ${period.evidenceDays} ימים` : `הנפקות ${period.evidenceDays} ימים`}</small></span>
        </div>
        {ppePending.slice(0, 2).map((request) => <div key={request.id} className="bi-doc-row"><b>{request.workerName || "עובד"}</b><span>{ppeRequestStatusLabel(request.status)} · {(request.lines || []).length || 1} פריטים</span></div>)}
        {!ppePending.length && ppeLowItems.slice(0, 2).map((item) => <div key={item.id} className="bi-doc-row"><b>{item.name || "פריט"}</b><span>מלאי נמוך</span></div>)}
        {!ppePending.length && !ppeLowItems.length && ppeRepeatWorkers.map((row) => <div key={row.key} className="bi-doc-row"><b>{row.label}</b><span>{row.n} הנפקות ב-{period.evidenceDays} ימים</span></div>)}
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>מטלות ופגישות</b><span>עבודה ניהולית שמתקדמת מחוץ לקריאה</span></div>{onGoTasks && <button className="btn-ghost sm" onClick={() => onGoTasks?.()}>למטלות</button>}</div>
        <div className="bi-mini-stats">
          <span><b>{openTasks.length}</b><small>מטלות פתוחות</small></span>
          <span><b>{overdueTasks.length}</b><small>באיחור</small></span>
          <span><b>{upcomingMeetings.length}</b><small>פגישות {period.trendDays} ימים</small></span>
        </div>
        {overdueTasks.slice(0, 2).map((task) => <button key={task.id} className="bi-doc-row bi-doc-action" onClick={() => onGoTasks?.({ id: task.id })}><b>{task.title || "מטלה"}</b><span>באיחור · {task.dueAt ? fmtDate(task.dueAt) : "ללא יעד"}</span></button>)}
        {!overdueTasks.length && upcomingMeetings.slice(0, 2).map((meeting) => <div key={meeting.id} className="bi-doc-row"><b>{meeting.title || "פגישה"}</b><span>{fmtDate(meeting.at)} {fmtTime(meeting.at)}</span></div>)}
      </section>

      <section className="panel bi-panel">
        <div className="bi-panel-head"><div><b>{scope.canViewFinancialBI ? "פיננסים" : "אנשים ושטח"}</b><span>{scope.canViewFinancialBI ? "מוצג רק להנהלה ולאדמין" : "ללא נתוני עלות"}</span></div></div>
        {scope.canViewFinancialBI ? <>
          <div className="big-stat">{ils(periodCost)}</div>
          <div className="rs-lbl">עלות סגירות ב-{period.evidenceDays} הימים האחרונים</div>
          <div className="bi-mini-stats bi-finance-stats">
            <span><b>{closedInEvidence.length}</b><small>סגירות עם עלות</small></span>
            <span><b>{avgClosedCost ? ils(avgClosedCost) : "—"}</b><small>ממוצע לסגירה</small></span>
            <span><b>{supplierCostRows.length}</b><small>ספקים בעלות</small></span>
          </div>
          {supplierCostRows.length > 0 && <div className="bi-subtitle">ספקים</div>}
          {supplierCostRows.length ? supplierCostRows.map(([supplier, value]) => <Bar key={supplier} label={supplier} value={value} max={maxSupplierCost} money color="#0D9488" onClick={() => onGoTickets?.({ st: "all", focus: { label: `BI · ספק · ${supplier}`, supplier } })} />) : <div className="note" style={{ marginTop: 10 }}>אין פירוט ספקים ל-{period.evidenceDays} הימים האחרונים.</div>}
          {categoryCostRows.length > 0 && <><div className="bi-subdivider" /><div className="bi-subtitle">קטגוריות</div>{categoryCostRows.map(([category, value]) => <Bar key={category} label={category} value={value} max={maxCategoryCost} money color="#1F4E8C" />)}</>}
          {assetCostRows.length > 0 && <><div className="bi-subdivider" /><div className="bi-subtitle">נכסים / אזורים</div>{assetCostRows.map(([asset, value]) => <Bar key={asset} label={asset} value={value} max={maxAssetCost} money color="#475569" />)}</>}
        </> : <div className="bi-mini-stats">
          <span><b>{scope.users.length}</b><small>עובדים/משתמשים</small></span>
          <span><b>{scope.zones.length}</b><small>אזורי ניקיון</small></span>
          <span><b>{scope.ppe.length}</b><small>רשומות ציוד</small></span>
        </div>}
      </section>
    </div>
  </div>;
}
