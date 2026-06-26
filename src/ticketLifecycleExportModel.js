export const TICKET_QUALITY_LABELS = {
  resolved: "טופל לחלוטין",
  temporary: "פתרון זמני",
  likely_repeat: "עשוי לחזור",
  purchase_needed: "נדרשת רכש",
  external_needed: "נדרש קבלן חוץ"
};

const currentStatusKey = (ticket) => ticket?.status === "waiting"
  ? `waiting:${ticket.waitingReason || "other"}`
  : (ticket?.status || "new");

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
  const durations = ticketLifecycleDurations(ticket, { now, isOpen });
  const labelOf = (key) => key.startsWith("waiting:")
    ? `המתנה · ${waitReasonLabel(key.slice(8))}`
    : statusLabel(key);
  const waiting = durations.filter(([key]) => key.startsWith("waiting:"));
  const equipmentWaitMs = (ticket?.equipWaitMs || 0) + (ticket?.waitingReason === "no_equipment" && ticket?.equipWaitSince ? Math.max(0, now - ticket.equipWaitSince) : 0);

  return {
    description: ticket?.description || "",
    sourceClass: ticket?.wearType ? wearLabel(ticket.wearType) : (ticket?.damageClass || ""),
    statusDurations: durations.map(([key, ms]) => `${labelOf(key)}: ${durationText(ms)}`).join(" · "),
    waitingDurations: waiting.map(([key, ms]) => `${waitReasonLabel(key.slice(8))}: ${durationText(ms)}`).join(" · "),
    equipmentWait: equipmentWaitMs ? durationText(equipmentWaitMs) : "",
    returned: ticket?.returned ? "כן" : "",
    returnReason: ticket?.returnReason || "",
    closureNote: ticket?.closure?.costNote || "",
    closureQuality: TICKET_QUALITY_LABELS[ticket?.closure?.quality] || ""
  };
}

export function ticketLifecycleRows(ticket, labels = {}) {
  const durations = ticketLifecycleDurations(ticket, labels);
  return durations.map(([key, ms]) => ({
    ticket,
    key,
    kind: key.startsWith("waiting:") ? "waiting" : "status",
    reason: key.startsWith("waiting:") ? key.slice(8) : "",
    ms
  }));
}

export function normalizedTicketLifecycleStages(ticket, {
  now = Date.now(),
  isOpen = () => true,
  statusLabel = (id) => id,
  waitReasonLabel = (id) => id
} = {}) {
  const stages = ticketLifecycleRows(ticket, { now, isOpen })
    .map((row) => ({
      key: row.key,
      kind: row.kind,
      reason: row.reason,
      label: row.kind === "waiting" ? waitReasonLabel(row.reason) : statusLabel(row.key),
      ms: row.ms,
      current: false
    }));

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
      current: ticket?.status === "waiting" && ticket?.waitingReason === "no_equipment"
    });
  }

  if (ticket?.returned || ticket?.returnReason) {
    stages.push({
      key: "rework",
      kind: "rework",
      reason: "",
      label: "הוחזר לטיפול",
      ms: 0,
      current: false
    });
  }

  return stages;
}

export function ticketHasLifecycleStage(ticket, key, options = {}) {
  if (!key) return false;
  return normalizedTicketLifecycleStages(ticket, options)
    .some((stage) => stage.key === key && (stage.current || stage.ms > 0 || stage.kind === "rework"));
}
