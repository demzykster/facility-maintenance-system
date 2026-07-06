export const CLEANING_ROUND_ACTIONABLE_STATUSES = Object.freeze(["due", "overdue"]);

export function isCleaningRoundActionableStatus(status) {
  return CLEANING_ROUND_ACTIONABLE_STATUSES.includes(status);
}

export function cleaningMissedWindowKey(zone = {}, win = {}, dayStart = 0) {
  return [zone.id || "zone", win.id || win.time || "window", dayStart || 0]
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]/g, "_"))
    .join("_");
}

export function cleaningWindowMinutes(win = {}) {
  const [h, m] = String(win.time || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function cleaningWindowBounds(win = {}, dayStart = 0) {
  const target = dayStart + cleaningWindowMinutes(win) * 60000;
  const tol = Math.max(0, Number(win.tol) || 0) * 60000;
  return {
    target,
    tol,
    slotStart: target - tol,
    slotEnd: target + tol
  };
}

export function cleaningChecklistForTarget(zone = {}, win = null, subzone = null) {
  const subzoneChecklist = Array.isArray(subzone?.checklist)
    ? subzone.checklist.filter((item) => String(item?.label || "").trim())
    : [];
  if (subzoneChecklist.length > 0) return subzoneChecklist;

  const checklist = Array.isArray(zone?.checklist)
    ? zone.checklist.filter((item) => String(item?.label || "").trim())
    : [];
  if (!win || !Array.isArray(win.items)) return checklist;

  const selected = new Set(win.items);
  return checklist.filter((item) => selected.has(item.id));
}

export function isMissedCleaningRound(round = {}) {
  return round.type === "missed" || round.status === "missed";
}

export function isCompletedCleaningRound(round = {}) {
  return !!round && !isMissedCleaningRound(round);
}

export function cleaningRoundMatchesWindow(round = {}, zoneId, win = {}, dayStart = 0, dayEnd = 0) {
  if (!round || round.zoneId !== zoneId || round.at < dayStart || round.at >= dayEnd) return false;
  if (round.winId || win.id) return round.winId === win.id;
  return false;
}

export function cleaningMissedRoundExists(rounds = [], zone = {}, win = {}, dayStart = 0, dayEnd = 0) {
  const key = cleaningMissedWindowKey(zone, win, dayStart);
  return (rounds || []).some((round) => isMissedCleaningRound(round) && (
    round.missedWindowKey === key || cleaningRoundMatchesWindow(round, zone.id, win, dayStart, dayEnd)
  ));
}

export function buildCleaningMissedRoundRecord({ zone = {}, winStatus = {}, dayStart = 0 }) {
  const win = winStatus.win || {};
  const key = cleaningMissedWindowKey(zone, win, dayStart);
  return {
    id: `missed_${key}`,
    type: "missed",
    status: "missed",
    missedWindowKey: key,
    zoneId: zone.id,
    zoneName: zone.name || "",
    zoneLoc: winStatus.zoneLoc || "",
    winId: win.id || null,
    winTime: win.time || null,
    at: winStatus.slotEnd || winStatus.target || Date.now(),
    scheduledAt: winStatus.target || null,
    slotStart: winStatus.slotStart || null,
    slotEnd: winStatus.slotEnd || null,
    byUid: zone.cleanerId || "",
    byName: zone.cleanerName || "",
    byRole: "cleaner",
    doneCount: 0,
    total: winStatus.totalItems || 0,
    items: {},
    issues: [],
    system: true,
    note: "missed cleaning round"
  };
}

export function cleaningMissedRoundRecordsForStatuses({ zone = {}, statuses = [], rounds = [], dayStart = 0, dayEnd = 0, zoneLoc = "" }) {
  return (statuses || [])
    .filter((status) => status.status === "missed")
    .filter((status) => !cleaningMissedRoundExists(rounds, zone, status.win, dayStart, dayEnd))
    .map((status) => buildCleaningMissedRoundRecord({
      zone,
      dayStart,
      winStatus: {
        ...status,
        zoneLoc,
        totalItems: Array.isArray(zone.checklist) ? zone.checklist.length : 0
      }
    }));
}
