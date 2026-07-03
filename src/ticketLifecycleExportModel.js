export const TICKET_QUALITY_LABELS = {
  resolved: "טופל לחלוטין",
  temporary: "פתרון זמני",
  likely_repeat: "עשוי לחזור",
  purchase_needed: "נדרשת רכש",
  external_needed: "נדרש קבלן חוץ"
};

const isTechAcceptanceStage = (ticket, key) => key === "new" && ticket?.routedTech && !ticket?.assignee;
const lifecycleStageKey = (ticket, key) => isTechAcceptanceStage(ticket, key) ? "new:tech_acceptance" : key;
const lifecycleStageLabel = (ticket, key, statusLabel) => lifecycleStageKey(ticket, key) === "new:tech_acceptance" ? "ממתין לקבלה" : statusLabel(key);

const currentStatusKey = (ticket) => ticket?.status === "waiting"
  ? `waiting:${ticket.waitingReason || "other"}`
  : lifecycleStageKey(ticket, ticket?.status || "new");

const DEFAULT_STATUS_OWNER = {
  new: "manager",
  "new:tech_acceptance": "executor",
  open: "manager",
  pending_manager: "manager",
  in_progress: "executor",
  waiting: "executor",
  pending_user: "requester",
  pending_admin: "admin",
  rework: "requester",
  done: "none",
  cancelled: "none"
};

const defaultWaitReasonMeta = (reason) => {
  if (reason === "no_equipment") return { ball: "manager", pauseSla: true };
  return {};
};

const stageOwner = (ticket, key, kind, reason, waitReasonMeta) => {
  if (kind === "waiting") {
    const meta = waitReasonMeta(reason) || {};
    return meta.ball || (ticket?.waitBall && key === currentStatusKey(ticket) ? ticket.waitBall : "") || defaultWaitReasonMeta(reason).ball || "executor";
  }
  if (kind === "rework") return "requester";
  return DEFAULT_STATUS_OWNER[key] || "executor";
};

const stageCountsOperationalSla = (key, kind, reason, waitReasonMeta) => {
  if (key === "done" || key === "cancelled") return false;
  if (kind !== "waiting") return true;
  const meta = waitReasonMeta(reason) || {};
  return !("pauseSla" in meta ? meta.pauseSla : defaultWaitReasonMeta(reason).pauseSla);
};

const stageCountsDowntime = (ticket, key, kind) => (
  ticket?.track === "transport"
  && !!ticket?.downtimeStart
  && key !== "done"
  && key !== "cancelled"
  && kind !== "rework"
);

export function ticketLifecycleDurations(ticket, { now = Date.now(), isOpen = () => true } = {}) {
  const durations = { ...(ticket?.statusMs || {}) };
  if (ticket && isOpen(ticket) && ticket.statusSince) {
    const key = currentStatusKey(ticket);
    durations[key] = (durations[key] || 0) + Math.max(0, now - ticket.statusSince);
  }
  return Object.entries(durations)
    .filter(([, ms]) => ms > 0)
    .sort((a, b) => b[1] - a[1]);
}

export function ticketLifecycleSummary(ticket, {
  now = Date.now(),
  isOpen = () => true,
  statusLabel = (id) => id,
  waitReasonLabel = (id) => id,
  wearLabel = (id) => id,
  durationText = (ms) => String(ms)
} = {}) {
  const rows = ticketLifecycleRows(ticket, { now, isOpen });
  const labelOf = (key) => key.startsWith("waiting:")
    ? `המתנה · ${waitReasonLabel(key.slice(8))}`
    : lifecycleStageLabel(ticket, key, statusLabel);
  const waiting = rows.filter((row) => row.kind === "waiting");
  const equipmentWaitMs = (ticket?.equipWaitMs || 0) + (ticket?.waitingReason === "no_equipment" && ticket?.equipWaitSince ? Math.max(0, now - ticket.equipWaitSince) : 0);

  return {
    description: ticket?.description || "",
    sourceClass: ticket?.wearType ? wearLabel(ticket.wearType) : (ticket?.damageClass || ""),
    statusDurations: rows.map((row) => `${labelOf(row.key)}: ${durationText(row.ms)}`).join(" · "),
    waitingDurations: waiting.map((row) => `${waitReasonLabel(row.reason)}: ${durationText(row.ms)}`).join(" · "),
    equipmentWait: equipmentWaitMs ? durationText(equipmentWaitMs) : "",
    returned: ticket?.returned ? "כן" : "",
    returnReason: ticket?.returnReason || "",
    closureNote: ticket?.closure?.costNote || "",
    closureQuality: TICKET_QUALITY_LABELS[ticket?.closure?.quality] || ""
  };
}

export function ticketLifecycleRows(ticket, labels = {}) {
  const durations = ticketLifecycleDurations(ticket, labels);
  const rows = new Map();
  durations.forEach(([rawKey, ms]) => {
    const key = lifecycleStageKey(ticket, rawKey);
    const existing = rows.get(key);
    if (existing) {
      existing.ms += ms;
      return;
    }
    rows.set(key, {
      ticket,
      key,
      kind: key.startsWith("waiting:") ? "waiting" : "status",
      reason: key.startsWith("waiting:") ? key.slice(8) : "",
      ms
    });
  });
  return [...rows.values()].sort((a, b) => b.ms - a.ms);
}

export function normalizedTicketLifecycleStages(ticket, {
  now = Date.now(),
  isOpen = () => true,
  statusLabel = (id) => id,
  waitReasonLabel = (id) => id,
  waitReasonMeta = defaultWaitReasonMeta
} = {}) {
  const stages = ticketLifecycleRows(ticket, { now, isOpen })
    .map((row) => {
      const current = ticket && isOpen(ticket) && ticket.statusSince && row.key === currentStatusKey(ticket);
      return {
      key: row.key,
      kind: row.kind,
      reason: row.reason,
      label: row.kind === "waiting" ? waitReasonLabel(row.reason) : lifecycleStageLabel(ticket, row.key, statusLabel),
      ms: row.ms,
      current: false,
      currentStartedAt: current ? ticket.statusSince : null,
      owner: stageOwner(ticket, row.key, row.kind, row.reason, waitReasonMeta),
      countsOperationalSla: stageCountsOperationalSla(row.key, row.kind, row.reason, waitReasonMeta),
      countsDowntime: stageCountsDowntime(ticket, row.key, row.kind),
      appearsIn: { export: true, analytics: true, dashboard: true }
    };
    });

  if (ticket && isOpen(ticket) && ticket.statusSince) {
    const key = currentStatusKey(ticket);
    const current = stages.find((stage) => stage.key === key);
    if (current) current.current = true;
  }

  const equipmentWaitMs = (ticket?.equipWaitMs || 0) + (ticket?.waitingReason === "no_equipment" && ticket?.equipWaitSince ? Math.max(0, now - ticket.equipWaitSince) : 0);
  if (equipmentWaitMs > 0 && !stages.some((stage) => stage.key === "waiting:no_equipment")) {
    stages.push({
      key: "waiting:no_equipment",
      kind: "waiting",
      reason: "no_equipment",
      label: waitReasonLabel("no_equipment"),
      ms: equipmentWaitMs,
      current: ticket?.status === "waiting" && ticket?.waitingReason === "no_equipment",
      currentStartedAt: ticket?.status === "waiting" && ticket?.waitingReason === "no_equipment" ? (ticket.statusSince || ticket.equipWaitSince || null) : null,
      owner: stageOwner(ticket, "waiting:no_equipment", "waiting", "no_equipment", waitReasonMeta),
      countsOperationalSla: stageCountsOperationalSla("waiting:no_equipment", "waiting", "no_equipment", waitReasonMeta),
      countsDowntime: stageCountsDowntime(ticket, "waiting:no_equipment", "waiting"),
      appearsIn: { export: true, analytics: true, dashboard: true }
    });
  }

  if (ticket?.returned || ticket?.returnReason) {
    stages.push({
      key: "rework",
      kind: "rework",
      reason: "",
      label: "הוחזר לטיפול",
      ms: 0,
      current: false,
      currentStartedAt: null,
      owner: stageOwner(ticket, "rework", "rework", "", waitReasonMeta),
      countsOperationalSla: true,
      countsDowntime: false,
      appearsIn: { export: true, analytics: true, dashboard: true }
    });
  }

  return stages;
}

export function ticketHasLifecycleStage(ticket, key, options = {}) {
  if (!key) return false;
  return normalizedTicketLifecycleStages(ticket, options)
    .some((stage) => stage.key === key && (stage.current || stage.ms > 0 || stage.kind === "rework"));
}

export function ticketLifecycleWaitReasonStats(tickets = [], options = {}) {
  const stats = {};
  (tickets || []).forEach((ticket) => {
    normalizedTicketLifecycleStages(ticket, options)
      .filter((stage) => stage.kind === "waiting" && stage.reason)
      .forEach((stage) => {
        const row = stats[stage.reason] || { reason: stage.reason, label: stage.label, n: 0, ms: 0 };
        row.n += 1;
        row.ms += stage.ms || 0;
        stats[stage.reason] = row;
      });
  });
  return Object.values(stats).sort((a, b) => b.ms - a.ms || b.n - a.n || a.label.localeCompare(b.label, "he"));
}

const fallbackPausedMs = (ticket, now = Date.now()) => (
  (ticket?.pauseAccumMs || 0) + (ticket?.pauseSince ? Math.max(0, now - ticket.pauseSince) : 0)
);

const operationalSlaMs = (ticket) => (
  ticket?.dueAt != null && ticket?.createdAt != null ? Math.max(0, ticket.dueAt - ticket.createdAt) : 0
);

export function ticketLifecycleNonOperationalMs(ticket, options = {}) {
  const now = options.now ?? Date.now();
  const lifecycleMs = normalizedTicketLifecycleStages(ticket, { ...options, now })
    .filter((stage) => stage.countsOperationalSla === false)
    .reduce((sum, stage) => sum + (stage.ms || 0), 0);

  return lifecycleMs > 0 ? lifecycleMs : fallbackPausedMs(ticket, now);
}

export function ticketLifecycleOperationalElapsedMs(ticket, at = Date.now(), options = {}) {
  const endAt = at ?? Date.now();
  return Math.max(0, endAt - (ticket?.createdAt ?? endAt) - ticketLifecycleNonOperationalMs(ticket, { ...options, now: endAt }));
}

export function ticketLifecycleMetOperationalSla(ticket, options = {}) {
  const closedAt = ticket?.closure?.signedAt ?? ticket?.updatedAt;
  const sla = operationalSlaMs(ticket);
  if (!sla || !closedAt) return false;
  return ticketLifecycleOperationalElapsedMs(ticket, closedAt, options) <= sla;
}

export function ticketLifecycleOperationalSlaRatio(ticket, options = {}) {
  const closedAt = ticket?.closure?.signedAt ?? ticket?.updatedAt;
  const sla = operationalSlaMs(ticket);
  if (!sla || !closedAt) return null;
  return ticketLifecycleOperationalElapsedMs(ticket, closedAt, options) / sla;
}

export function ticketLifecycleMissedOperationalSla(ticket, options = {}) {
  const now = options.now ?? Date.now();
  const sla = operationalSlaMs(ticket);
  if (!sla || ticket?.status === "cancelled") return false;
  if (ticket?.status === "done") return !ticketLifecycleMetOperationalSla(ticket, options);
  return ticketLifecycleOperationalElapsedMs(ticket, now, options) > sla;
}
