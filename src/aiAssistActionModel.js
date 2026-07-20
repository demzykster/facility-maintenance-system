const MAX_SUBJECT_CHARS = 80;
const MAX_DESCRIPTION_CHARS = 1200;
const HOUR = 3600000;
const DAY = 86400000;

const cleanText = (value, limit = 240) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const cleanArray = (value) => Array.isArray(value) ? value : [];
const hasCapability = (context = {}, key = "") => context?.profile?.capabilities?.[key] === true;

const LOCATION_PATTERNS = [
  /(?:באזור|באיזור|במחלקת|במחסן|במבנה|בקו)\s+([^\n,.]+)/i,
  /(?:zone|area|department|warehouse|building)\s+([^\n,.]+)/i,
  /(?:в\s+зоне|в\s+отделе|на\s+складе|в\s+складе|в\s+здании|в\s+корпусе|в\s+комнате|в|на|у|около|возле)\s+([^\n,.]+)/iu
];
const LOCATION_PROBLEM_ONLY_RE = /^(?:לא\s+עובד|לא\s+עובדת|שבור|שבורה|שבורים|תקול|תקולה|broken|not\s+working|не\s+работ|сломал)/iu;

function cleanLocationHint(value = "") {
  const location = cleanText(value, 120);
  if (!location || LOCATION_PROBLEM_ONLY_RE.test(location.toLowerCase())) return "";
  return location;
}

function locationFromDraft(draft = {}) {
  const signalLocation = cleanLocationHint(draft.signals?.locationHint);
  if (signalLocation) return signalLocation;
  const raw = cleanText(draft.rawText, MAX_DESCRIPTION_CHARS);
  const match = LOCATION_PATTERNS.map((pattern) => raw.match(pattern)).find(Boolean);
  return match ? cleanLocationHint(match[1]) : "";
}

function subjectFromDraft(draft = {}) {
  const raw = cleanText(draft.rawText, MAX_DESCRIPTION_CHARS);
  if (!raw) return "";
  return raw.length > MAX_SUBJECT_CHARS ? `${raw.slice(0, MAX_SUBJECT_CHARS - 1).trim()}…` : raw;
}

function priorityFromSeverity(severity = "normal") {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "low") return "low";
  return "medium";
}

function priorityFromDowntimeType(downtimeType = "") {
  if (downtimeType === "critical") return "high";
  if (downtimeType === "minor") return "low";
  if (downtimeType === "has_replacement") return "medium";
  return "";
}

function ticketTrackForModule(module = "") {
  if (module === "transport") return "transport";
  if (["facility", "safety"].includes(module)) return "facility";
  return "";
}

function ticketCategoryForModule(module = "") {
  if (module === "transport") return "transport";
  if (module === "safety") return "safety";
  if (module === "facility") return "";
  return "";
}

function missingFieldsForTicketPayload(payload = {}, draft = {}) {
  const missing = [];
  if (!payload.track) missing.push("track");
  if (!payload.subject) missing.push("subject");
  if (!payload.description) missing.push("description");
  if (payload.track === "facility" && !payload.zone) missing.push("zone");
  if (payload.track === "transport" && !payload.forkliftId) missing.push("forkliftId");
  if (payload.track === "transport" && !payload.downtimeType) missing.push("downtimeType");
  if (draft.module === "unknown") missing.push("module");
  return [...new Set(missing)];
}

function shouldReviewTicketCreateInForm(payload = {}, missingFields = []) {
  const missing = Array.isArray(missingFields) ? missingFields : [];
  if (payload.track === "transport"
    && payload.forkliftId
    && missing.length === 1
    && missing[0] === "downtimeType") return true;
  return false;
}

function requestedPriorityFromText(text = "") {
  const raw = cleanText(text, 500).toLowerCase();
  if (!raw) return "";
  if (/עדיפות|priority|דחוף|גבוה|גבוהה|high|critical|urgent/i.test(raw)) {
    if (/נמוך|נמוכה|low/i.test(raw)) return "low";
    if (/בינוני|בינונית|medium|normal/i.test(raw)) return "medium";
    if (/גבוה|גבוהה|דחוף|high|critical|urgent/i.test(raw)) return "high";
  }
  return "";
}

function requestedTicketStatusFromText(text = "") {
  const raw = cleanText(text, 500).toLowerCase();
  if (!raw) return "";
  if (/סטטוס|מצב|status|העבר|תעדכן|עדכן|change|update|סיים|סגור|בטל/i.test(raw)) {
    if (/בוצע|סגור|סיים|הושלם|done|completed|closed/i.test(raw)) return "done";
    if (/בטיפול|בעבודה|בתהליך|in.?progress/i.test(raw)) return "in_progress";
    if (/חדשה|חדש|new/i.test(raw)) return "new";
    if (/ממתינ|המתנה|waiting/i.test(raw)) return "waiting";
    if (/בוטל|בטל|cancel/i.test(raw)) return "cancelled";
  }
  return "";
}

function requestedTaskStatusFromText(text = "") {
  const raw = cleanText(text, 500).toLowerCase();
  if (!raw) return "";
  if (/סטטוס|מצב|status|העבר|תעדכן|עדכן|change|update|סיים|סגור|בטל/i.test(raw)) {
    if (/בוצע|סגור|סיים|הושלם|done|completed|closed/i.test(raw)) return "done";
    if (/בטיפול|בעבודה|בתהליך|in.?progress/i.test(raw)) return "in_progress";
    if (/ממתינ|המתנה|waiting/i.test(raw)) return "waiting";
    if (/בוטל|בטל|cancel/i.test(raw)) return "cancelled";
    if (/חדש|פתוח|todo|open/i.test(raw)) return "todo";
  }
  return "";
}

function requestedDowntimeTypeFromText(text = "") {
  const raw = cleanText(text, 800).toLowerCase();
  if (!raw) return "";
  if (/יש\s+תחליף|קיים\s+תחליף|תחליף\s+זמין|with\s+replacement|replacement\s+available|backup\s+available|spare\s+available/i.test(raw)) return "has_replacement";
  if (/אין\s+תחליף|ללא\s+תחליף|מושבת(?:ת)?\s+ואין|הכלי\s+מושבת|מוציא(?:ה)?\s+מכלל\s+שימוש|השבתה\s+קריטית|out\s+of\s+service|no\s+replacement|no\s+spare|critical\s+downtime/i.test(raw)) return "critical";
  if (/ניתן\s+להמשיך\s+לעבוד|אפשר\s+להמשיך\s+לעבוד|לא\s+מוציא(?:ה)?\s+מכלל\s+שימוש|לא\s+מושבת|minor\s+downtime|minor|can\s+continue/i.test(raw)) return "minor";
  return "";
}

function requestedCalendarDateFromText(text = "", now = Date.now()) {
  const raw = cleanText(text, 800);
  if (!raw) return null;
  const match = raw.match(/(?:^|[^\d])([0-3]?\d)[./]([01]?\d)[./](\d{2}|\d{4})(?=$|[^\d])/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearPart = Number(match[3]);
  const year = match[3].length === 2 ? 2000 + yearPart : yearPart;
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const base = new Date(Number.isFinite(Number(now)) ? Number(now) : Date.now());
  const date = new Date(
    year,
    month - 1,
    day,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds()
  );
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.getTime();
}

function requestedTaskDueAtFromText(text = "", now = Date.now()) {
  const raw = cleanText(text, 800).toLowerCase();
  const base = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (!raw) return null;
  const calendarDate = requestedCalendarDateFromText(raw, base);
  if (calendarDate !== null) return calendarDate;
  const inDays = raw.match(/(?:בעוד|תוך|in)\s+(\d{1,2})\s*(?:ימים|יום|days?|d\b)/i);
  if (inDays) return base + Number(inDays[1]) * DAY;
  if (/מחר|tomorrow/i.test(raw)) return base + DAY;
  if (/היום|today/i.test(raw)) return base;
  return null;
}

function explicitClockTimeFromText(text = "") {
  const raw = cleanText(text, 800);
  const match = raw.match(/(?:ב-?|בשעה|at\s+)?([01]?\d|2[0-3]):([0-5]\d)/i);
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function requestedMeetingAtFromText(text = "", now = Date.now()) {
  const baseAt = requestedTaskDueAtFromText(text, now);
  if (baseAt === null) return null;
  const clock = explicitClockTimeFromText(text);
  if (!clock) return baseAt;
  const date = new Date(baseAt);
  date.setHours(clock.hours, clock.minutes, 0, 0);
  return date.getTime();
}

function hasMeetingCreateIntent(text = "") {
  return /פגישה|ישיבה|meeting/i.test(cleanText(text, 800));
}

function hasPpeRequestIntent(text = "") {
  return /(צריך|צריכ|בקשה|מבקש|אבקש|הזמן|תזמין|request|need|order|ביגוד|ציוד|נעליים|נעלי|קסדה|כפפות|אפוד|מידה|ppe|clothing|shoes|helmet|gloves|vest|size)/i.test(cleanText(text, 800));
}

function cleaningKindFromText(text = "") {
  const raw = cleanText(text, 800).toLowerCase();
  if (/תקלה|שבור|שבורה|שבר|דליפ|דולף|נוזל|סתימה|לא עובד|broken|leak|fault|clog/i.test(raw)) return "broken";
  return "dirty";
}

function cleaningZoneMatchesText(zone = {}, raw = "") {
  const text = cleanText(raw, 800).toLowerCase();
  const candidates = [
    zone.id,
    zone.code,
    zone.name,
    zone.location,
    zone.zoneLoc,
    zone.area,
    zone.building,
    zone.floor
  ].map((value) => cleanText(value, 160).toLowerCase()).filter((value) => value.length >= 2);
  return candidates.some((value) => text.includes(value));
}

function requestedCleaningZoneFromText(text = "", zones = []) {
  const raw = cleanText(text, 800);
  if (!raw) return null;
  const matches = cleanArray(zones)
    .filter((zone) => zone && zone.active !== false && zone.id)
    .filter((zone) => cleaningZoneMatchesText(zone, raw));
  return matches.length === 1 ? matches[0] : null;
}

function hasUpdateIntent(text = "") {
  return /תעדכן|עדכן|העבר|שנה|סיים|סגור|בטל|update|change|set|mark/i.test(cleanText(text, 800));
}

function hasTaskResponsibleUpdateIntent(text = "") {
  return hasUpdateIntent(text) && /(אחראי|אחראים|responsible|assign|assigned|owner|אל|to\s+)/i.test(cleanText(text, 800));
}

function userMatchesText(user = {}, raw = "") {
  const text = cleanText(raw, 800).toLowerCase();
  const identifiers = [
    cleanText(user.id, 120),
    cleanText(user.workerNo, 120)
  ].filter((value) => value.length >= 2);
  const identifierMatch = identifiers.some((value) => {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
  });
  if (identifierMatch) return true;
  const name = cleanText(user.name, 120).toLowerCase();
  return name.length >= 2 && text.includes(name);
}

function requestedTaskResponsibleUserFromText(text = "", users = []) {
  const raw = cleanText(text, 800);
  if (!raw || !hasTaskResponsibleUpdateIntent(raw)) return null;
  const matches = cleanArray(users)
    .filter((user) => user && user.id)
    .filter((user) => userMatchesText(user, raw));
  return matches.length === 1 ? matches[0] : null;
}

function requestedZoneFromText(text = "") {
  const raw = cleanText(text, 800);
  if (!raw || !hasUpdateIntent(raw)) return "";
  const patterns = [
    /(?:אזור|איזור|מיקום)\s*(?:ל|אל|=|:|-)\s*([^\n,.]+)/i,
    /(?:לאזור|לאיזור|למיקום)\s+([^\n,.]+)/i,
    /(?:zone|area|location)\s*(?:to|=|:|-)\s*([^\n,.]+)/i
  ];
  const match = patterns.map((pattern) => raw.match(pattern)).find(Boolean);
  if (!match) return "";
  return cleanText(match[1], 120)
    .replace(/^(?:של|את)\s+/i, "")
    .replace(/\s+(?:בבקשה|please)$/i, "")
    .trim();
}

function hasFleetUnitUpdateIntent(text = "") {
  return hasUpdateIntent(text) && /(כלי|מלגזה|ציוד|forklift|vehicle|unit|asset)/i.test(cleanText(text, 800));
}

function fleetUnitMatchesText(unit = {}, raw = "") {
  const text = cleanText(raw, 800).toLowerCase();
  const identifiers = [
    cleanText(unit.id, 120),
    cleanText(unit.code, 120),
    cleanText(unit.num, 120),
    cleanText(unit.number, 120),
    cleanText(unit.asset, 120),
    cleanText(unit.unitCode, 120),
    cleanText(unit.workerNo, 120),
    cleanText(unit.workerNumber, 120),
    cleanText(unit.vehicleNo, 120),
    cleanText(unit.vehicleNumber, 120),
    cleanText(unit.registration, 120),
    cleanText(unit.registrationNumber, 120),
    cleanText(unit.licensePlate, 120),
    cleanText(unit.displayNumber, 120),
    cleanText(unit.displayNo, 120)
  ].filter((value) => value.length >= 2);
  return identifiers.some((value) => {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
  });
}

function requestedFleetUnitFromText(text = "", fleet = []) {
  const raw = cleanText(text, 800);
  if (!raw || !hasFleetUnitUpdateIntent(raw)) return null;
  return uniqueFleetUnitMentionFromText(raw, fleet);
}

function uniqueFleetUnitMentionFromText(text = "", fleet = []) {
  const raw = cleanText(text, 800);
  if (!raw || !/(כלי|מלגזה|ציוד|forklift|vehicle|unit|asset)/i.test(raw)) return null;
  const matches = cleanArray(fleet)
    .filter((unit) => unit && unit.id)
    .filter((unit) => fleetUnitMatchesText(unit, raw));
  return matches.length === 1 ? matches[0] : null;
}

function draftFleetUnitFromText(text = "", fleet = []) {
  return uniqueFleetUnitMentionFromText(text, fleet);
}

function ppeItemMatchesText(item = {}, raw = "") {
  const text = cleanText(raw, 800).toLowerCase();
  const candidates = [
    item.id,
    item.name,
    item.category,
    ...(Array.isArray(item.aliases) ? item.aliases : [])
  ].map((value) => cleanText(value, 160).toLowerCase()).filter((value) => value.length >= 2);
  return candidates.some((value) => text.includes(value));
}

function requestedPpeItemFromText(text = "", items = []) {
  const raw = cleanText(text, 800);
  if (!raw || !hasPpeRequestIntent(raw)) return null;
  const matches = cleanArray(items)
    .filter((item) => item && item.id && item.active !== false)
    .filter((item) => ppeItemMatchesText(item, raw));
  return matches.length === 1 ? matches[0] : null;
}

function requestedPpeSizeFromText(text = "", item = {}) {
  const raw = cleanText(text, 800).toLowerCase();
  const sizes = cleanArray(item.sizes).map((size) => cleanText(size, 40)).filter(Boolean);
  if (sizes.length === 1) return sizes[0];
  const match = sizes.find((size) => {
    const escaped = size.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(raw);
  });
  return match || "";
}

const WAITING_REASON_BALLS = Object.freeze({
  no_equipment: "manager",
  parts: "executor",
  supplier: "executor",
  access: "executor",
  manager_decision: "manager",
  budget_approval: "admin",
  external_contractor: "executor",
  safety_hold: "manager"
});

function requestedWaitingReasonFromText(text = "") {
  const raw = cleanText(text, 800).toLowerCase();
  if (!raw || !/ממתינ|המתנה|waiting|hold/i.test(raw)) return "";
  if (/לא התקבל הכלי|אין כלי|הכלי לא|no.?equipment|tool not received/i.test(raw)) return "no_equipment";
  if (/חלקים|חלפים|parts|spare/i.test(raw)) return "parts";
  if (/אישור תקציב|תקציב|budget/i.test(raw)) return "budget_approval";
  if (/גישה|access/i.test(raw)) return "access";
  if (/החלטת מנהל|החלטה|manager/i.test(raw)) return "manager_decision";
  if (/קבלן חוץ|contractor/i.test(raw)) return "external_contractor";
  if (/בטיחות|safety/i.test(raw)) return "safety_hold";
  if (/ספק|supplier|vendor/i.test(raw)) return "supplier";
  return "";
}

function hasWaitingStatusIntent(text = "") {
  return /ממתינ|המתנה|waiting|hold/i.test(cleanText(text, 800));
}

function requestedSupplierFromText(text = "", suppliers = []) {
  const raw = cleanText(text, 800).toLowerCase();
  if (!raw || !hasSupplierRoutingIntent(raw)) return "";
  const matches = cleanArray(suppliers)
    .map((supplier) => cleanText(supplier?.name, 160))
    .filter(Boolean)
    .filter((name) => raw.includes(name.toLowerCase()));
  const uniqueMatches = [...new Set(matches)];
  return uniqueMatches.length === 1 ? uniqueMatches[0] : "";
}

function canProposeSupplierRouting(context = {}) {
  return hasCapability(context, "supplierRouting");
}

function hasSupplierRoutingIntent(text = "") {
  return /(ספק|קבלן|contractor|supplier|vendor|העבר|תעביר|שייך|assign|route)/i.test(cleanText(text, 800));
}

function requestedCommentFromText(text = "") {
  const raw = cleanText(text, MAX_DESCRIPTION_CHARS);
  if (!raw) return "";
  const patterns = [
    /(?:הוסף|תוסיף|להוסיף|כתוב|תרשום)\s+הערה[:\-\s]+(.+)/i,
    /הערה[:\-\s]+(.+)/i,
    /(?:add|write)\s+(?:a\s+)?(?:note|comment)[:\-\s]+(.+)/i,
    /(?:note|comment)[:\-\s]+(.+)/i
  ];
  const match = patterns.map((pattern) => raw.match(pattern)).find(Boolean);
  return match ? cleanText(match[1], 800) : "";
}

function buildAiTicketCommentProposal({ draft = {}, context = {} } = {}) {
  const tickets = cleanArray(context.tickets).filter((ticket) => ticket && ticket.id);
  if (tickets.length !== 1) return null;
  const note = requestedCommentFromText(draft.rawText);
  if (!note) return null;
  const ticket = tickets[0];
  return {
    id: `comment_ticket_${cleanText(ticket.id, 80)}`,
    type: "ticket.comment",
    label: "הוספת הערה",
    status: "ready_for_confirmation",
    requiresConfirmation: true,
    writesData: false,
    writePolicy: "human_confirmation_required",
    missingFields: [],
    payload: {
      ticketId: cleanText(ticket.id, 160),
      ticketTitle: cleanText(ticket.subject || ticket.title || ticket.number || ticket.no, 160),
      note
    },
    execute: {
      method: "POST",
      path: "/api/tickets",
      bodyField: "ticket"
    },
    safety: {
      deterministic: true,
      providerTextTrusted: false,
      serverMustRevalidate: true,
      auditRequired: true
    }
  };
}

function buildAiTicketUpdateProposal({ draft = {}, context = {} } = {}) {
  const tickets = cleanArray(context.tickets).filter((ticket) => ticket && ticket.id);
  if (tickets.length !== 1) return null;
  const ticket = tickets[0];
  const patch = {};
  const requestedPriority = requestedPriorityFromText(draft.rawText);
  if (requestedPriority && requestedPriority !== ticket.priority) patch.priority = requestedPriority;
  const requestedStatus = requestedTicketStatusFromText(draft.rawText);
  if (requestedStatus === "waiting") {
    const requestedWaitingReason = requestedWaitingReasonFromText(draft.rawText);
    if (requestedWaitingReason) {
      if (ticket.status !== "waiting") patch.status = "waiting";
      if (requestedWaitingReason !== ticket.waitingReason) patch.waitingReason = requestedWaitingReason;
      const waitBall = WAITING_REASON_BALLS[requestedWaitingReason] || "executor";
      if (waitBall !== ticket.waitBall) patch.waitBall = waitBall;
    }
  } else if (requestedStatus && requestedStatus !== ticket.status) {
    patch.status = requestedStatus;
    if (ticket.status === "waiting") {
      patch.waitingReason = null;
      patch.waitBall = null;
    }
  }
  const requestedSupplier = canProposeSupplierRouting(context) ? requestedSupplierFromText(draft.rawText, context.suppliers) : "";
  if (requestedSupplier && requestedSupplier !== ticket.supplier) patch.supplier = requestedSupplier;
  const requestedZone = requestedZoneFromText(draft.rawText);
  if (requestedZone && requestedZone !== ticket.zone) patch.zone = requestedZone;
  const requestedFleetUnit = requestedFleetUnitFromText(draft.rawText, context.fleet);
  if (requestedFleetUnit) {
    const nextForkliftId = cleanText(requestedFleetUnit.id, 160);
    const nextAsset = cleanText(requestedFleetUnit.code || requestedFleetUnit.number || requestedFleetUnit.asset || requestedFleetUnit.id, 160);
    if (nextForkliftId && nextForkliftId !== ticket.forkliftId) patch.forkliftId = nextForkliftId;
    if (nextAsset && nextAsset !== ticket.asset) patch.asset = nextAsset;
  }
  if (!Object.keys(patch).length) return null;
  const current = Object.fromEntries(Object.keys(patch).map((field) => [field, ticket[field] ?? ""]));
  return {
    id: `update_ticket_${cleanText(ticket.id, 80)}`,
    type: "ticket.update",
    label: "עדכון קריאה",
    status: "ready_for_confirmation",
    requiresConfirmation: true,
    writesData: false,
    writePolicy: "human_confirmation_required",
    missingFields: [],
    payload: {
      ticketId: cleanText(ticket.id, 160),
      ticketTitle: cleanText(ticket.subject || ticket.title || ticket.number || ticket.no, 160),
      current,
      patch
    },
    execute: {
      method: "POST",
      path: "/api/tickets",
      bodyField: "ticket"
    },
    safety: {
      deterministic: true,
      providerTextTrusted: false,
      serverMustRevalidate: true,
      auditRequired: true
    }
  };
}

function buildAiTaskUpdateProposal({ draft = {}, context = {}, now = Date.now() } = {}) {
  const tasks = cleanArray(context.tasks).filter((task) => task && task.id);
  if (tasks.length !== 1 || !hasUpdateIntent(draft.rawText)) return null;
  const task = tasks[0];
  const patch = {};
  const requestedPriority = requestedPriorityFromText(draft.rawText);
  if (requestedPriority && requestedPriority !== task.priority) patch.priority = requestedPriority;
  const requestedStatus = requestedTaskStatusFromText(draft.rawText);
  if (requestedStatus && requestedStatus !== task.status) patch.status = requestedStatus;
  const requestedDueAt = requestedTaskDueAtFromText(draft.rawText, now);
  if (requestedDueAt !== null && requestedDueAt !== task.dueAt) patch.dueAt = requestedDueAt;
  const requestedResponsible = requestedTaskResponsibleUserFromText(draft.rawText, context.users);
  if (requestedResponsible) {
    const nextResponsibleIds = [cleanText(requestedResponsible.id, 160)].filter(Boolean);
    const currentResponsibleIds = cleanArray(task.responsibleIds).map((value) => cleanText(value, 160)).filter(Boolean);
    if (nextResponsibleIds.length && currentResponsibleIds.join("|") !== nextResponsibleIds.join("|")) {
      patch.responsibleIds = nextResponsibleIds;
    }
  }
  if (!Object.keys(patch).length) return null;
  const current = Object.fromEntries(Object.keys(patch).map((field) => [field, task[field]]));
  const display = patch.responsibleIds ? {
    responsibleIds: {
      before: cleanArray(task.responsibleIds)
        .map((id) => cleanText(cleanArray(context.users).find((user) => user.id === id)?.name || id, 120))
        .filter(Boolean),
      after: [cleanText(requestedResponsible?.name || patch.responsibleIds[0], 120)].filter(Boolean)
    }
  } : null;
  return {
    id: `update_task_${cleanText(task.id, 80)}`,
    type: "task.update",
    label: "עדכון משימה",
    status: "ready_for_confirmation",
    requiresConfirmation: true,
    writesData: false,
    writePolicy: "human_confirmation_required",
    missingFields: [],
    payload: {
      taskId: cleanText(task.id, 160),
      taskTitle: cleanText(task.title || task.name, 160),
      current,
      patch,
      ...(display ? { display } : {})
    },
    execute: {
      method: "POST",
      path: "/api/work",
      resource: "tasks",
      bodyField: "task"
    },
    safety: {
      deterministic: true,
      providerTextTrusted: false,
      serverMustRevalidate: true,
      auditRequired: true
    }
  };
}

function buildAiMeetingUpdateProposal({ draft = {}, context = {}, now = Date.now() } = {}) {
  const meetings = cleanArray(context.meetings).filter((meeting) => meeting && meeting.id);
  if (meetings.length !== 1 || !hasUpdateIntent(draft.rawText) || !hasMeetingCreateIntent(draft.rawText)) return null;
  const meeting = meetings[0];
  const patch = {};
  const requestedAt = requestedMeetingAtFromText(draft.rawText, now);
  if (requestedAt !== null && requestedAt !== meeting.at) patch.at = requestedAt;
  if (!Object.keys(patch).length) return null;
  const current = Object.fromEntries(Object.keys(patch).map((field) => [field, meeting[field]]));
  return {
    id: `update_meeting_${cleanText(meeting.id, 80)}`,
    type: "meeting.update",
    label: "עדכון פגישה",
    status: "ready_for_confirmation",
    requiresConfirmation: true,
    writesData: false,
    writePolicy: "human_confirmation_required",
    missingFields: [],
    payload: {
      meetingId: cleanText(meeting.id, 160),
      meetingTitle: cleanText(meeting.title || meeting.name, 160),
      current,
      patch
    },
    execute: {
      method: "POST",
      path: "/api/work",
      resource: "meetings",
      bodyField: "meeting"
    },
    safety: {
      deterministic: true,
      providerTextTrusted: false,
      serverMustRevalidate: true,
      auditRequired: true
    }
  };
}

export function buildAiTicketCreatePayload({ draft = {}, user = {}, now = Date.now(), context = {} } = {}) {
  const module = cleanText(draft.module, 40);
  const track = ticketTrackForModule(module);
  const location = locationFromDraft(draft);
  const subject = subjectFromDraft(draft);
  const description = cleanText(draft.rawText, MAX_DESCRIPTION_CHARS);
  const downtimeType = track === "transport" ? requestedDowntimeTypeFromText(draft.rawText) : "";
  const priority = priorityFromDowntimeType(downtimeType) || priorityFromSeverity(draft.severity);
  const createdAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const fleetUnit = track === "transport" ? draftFleetUnitFromText(draft.rawText, context.fleet) : null;
  const fleetAsset = fleetUnit ? cleanText(fleetUnit.code || fleetUnit.num || fleetUnit.number || fleetUnit.asset || fleetUnit.unitCode || fleetUnit.workerNo || fleetUnit.vehicleNumber || fleetUnit.licensePlate || fleetUnit.displayNumber || fleetUnit.id, 160) : "";
  const payload = {
    track,
    subject,
    category: ticketCategoryForModule(module),
    categoryLabel: "",
    priority,
    zone: location,
    asset: fleetAsset,
    forkliftId: fleetUnit ? cleanText(fleetUnit.id, 160) : "",
    downtimeType,
    description,
    status: "new",
    assignee: "",
    routedTech: track === "transport" ? true : undefined,
    supplier: "",
    createdBy: {
      id: cleanText(user.id || user.authUserId || user.workerNo, 120),
      name: cleanText(user.name, 120),
      role: cleanText(user.role, 40),
      dept: cleanText(user.dept || user.department, 120),
      phone: cleanText(user.phone, 80),
      email: cleanText(user.email, 160)
    },
    createdAt,
    updatedAt: createdAt,
    dueAt: createdAt + (priority === "high" ? 8 : 48) * HOUR,
    hasPhoto: false,
    closure: null,
    log: [{
      at: createdAt,
      by: cleanText(user.name, 120),
      byRole: cleanText(user.role, 40),
      text: "טיוטת קריאה הוכנה על ידי AI וממתינה לאישור משתמש",
      kind: "ai_draft"
    }],
    ai: {
      drafted: true,
      source: "ai_assist",
      draftVersion: Number(draft.version || 1)
    }
  };
  return payload;
}

export function buildAiTaskCreatePayload({ draft = {}, user = {}, now = Date.now() } = {}) {
  const createdAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const actorId = cleanText(user.id || user.authUserId || user.workerNo, 120);
  const actorName = cleanText(user.name, 120);
  const actorRole = cleanText(user.role, 40);
  const title = subjectFromDraft(draft);
  const desc = cleanText(draft.rawText, MAX_DESCRIPTION_CHARS);
  return {
    title,
    desc,
    status: "todo",
    priority: priorityFromSeverity(draft.severity),
    sourceModule: "ai_assist",
    ownerId: actorId,
    responsibleIds: actorId ? [actorId] : [],
    participantIds: [],
    dueAt: null,
    createdAt,
    updatedAt: createdAt,
    createdBy: {
      id: actorId,
      name: actorName,
      role: actorRole,
      dept: cleanText(user.dept || user.department, 120),
      phone: cleanText(user.phone, 80),
      email: cleanText(user.email, 160)
    },
    log: [{
      at: createdAt,
      by: actorName,
      byRole: actorRole,
      text: "טיוטת משימה הוכנה על ידי AI וממתינה לאישור משתמש",
      kind: "ai_draft"
    }],
    ai: {
      drafted: true,
      source: "ai_assist",
      draftVersion: Number(draft.version || 1)
    }
  };
}

export function buildAiMeetingCreatePayload({ draft = {}, user = {}, now = Date.now() } = {}) {
  const createdAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const actorId = cleanText(user.id || user.authUserId || user.workerNo, 120);
  const actorName = cleanText(user.name, 120);
  const actorRole = cleanText(user.role, 40);
  const title = subjectFromDraft(draft);
  const at = requestedMeetingAtFromText(draft.rawText, createdAt);
  return {
    title,
    type: "boss",
    purpose: cleanText(draft.rawText, MAX_DESCRIPTION_CHARS),
    at,
    participantIds: actorId ? [actorId] : [],
    agenda: "",
    decisions: "",
    recur: null,
    standingTopics: [],
    topicMarks: {},
    status: "planned",
    ownerId: actorId,
    createdBy: {
      id: actorId,
      name: actorName,
      role: actorRole,
      dept: cleanText(user.dept || user.department, 120),
      phone: cleanText(user.phone, 80),
      email: cleanText(user.email, 160)
    },
    createdAt,
    updatedAt: createdAt,
    log: [{
      at: createdAt,
      by: actorName,
      byRole: actorRole,
      text: "טיוטת פגישה הוכנה על ידי AI וממתינה לאישור משתמש",
      kind: "ai_draft"
    }],
    ai: {
      drafted: true,
      source: "ai_assist",
      draftVersion: Number(draft.version || 1)
    }
  };
}

function missingFieldsForTaskPayload(payload = {}) {
  const missing = [];
  if (!payload.title) missing.push("title");
  if (!payload.desc) missing.push("desc");
  if (!cleanArray(payload.responsibleIds).length) missing.push("responsibleIds");
  return [...new Set(missing)];
}

function missingFieldsForMeetingPayload(payload = {}) {
  const missing = [];
  if (!payload.title) missing.push("title");
  if (!Number.isFinite(Number(payload.at))) missing.push("at");
  if (!cleanArray(payload.participantIds).length) missing.push("participantIds");
  return [...new Set(missing)];
}

function buildAiPpeRequestCreateProposal({ draft = {}, user = {}, context = {} } = {}) {
  const item = requestedPpeItemFromText(draft.rawText, context?.ppe?.items);
  if (!item) return null;
  const size = requestedPpeSizeFromText(draft.rawText, item);
  const missingFields = size ? [] : ["size"];
  const actorId = cleanText(user.id || user.authUserId || user.workerNo, 120);
  const workerName = cleanText(user.name, 120);
  const workerNo = cleanText(user.workerNo, 80);
  const dept = cleanText(user.dept || user.department, 120);
  if (!actorId || !workerName) missingFields.push("worker");
  const itemId = cleanText(item.id, 160);
  return {
    id: `create_ppe_request_${itemId}`,
    type: "ppe.request.create",
    label: "בקשת ביגוד",
    status: missingFields.length ? "needs_human_input" : "ready_for_confirmation",
    requiresConfirmation: true,
    writesData: false,
    writePolicy: "human_confirmation_required",
    missingFields: [...new Set(missingFields)],
    payload: {
      workerId: actorId,
      workerName,
      workerNo,
      dept,
      lines: [{
        itemId,
        itemName: cleanText(item.name, 160),
        category: cleanText(item.category, 80),
        size,
        qty: 1
      }],
      note: cleanText(draft.rawText, 800)
    },
    execute: {
      method: "POST",
      path: "/api/ppe",
      resource: "requests",
      bodyField: "request"
    },
    safety: {
      deterministic: true,
      providerTextTrusted: false,
      serverMustRevalidate: true,
      auditRequired: true
    }
  };
}

function buildAiCleaningComplaintCreateProposal({ draft = {}, user = {}, context = {}, now = Date.now() } = {}) {
  const zones = cleanArray(context?.cleaning?.zones).filter((zone) => zone && zone.active !== false && zone.id);
  const zone = requestedCleaningZoneFromText(draft.rawText, zones);
  const actorId = cleanText(user.id || user.authUserId || user.workerNo, 120);
  const actorName = cleanText(user.name, 120);
  const actorRole = cleanText(user.role, 40);
  const createdAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const missingFields = zone ? [] : ["zoneId"];
  return {
    id: zone ? `create_cleaning_complaint_${cleanText(zone.id, 80)}` : "create_cleaning_complaint",
    type: "cleaning.complaint.create",
    label: "דיווח ניקיון",
    status: missingFields.length ? "needs_human_input" : "ready_for_confirmation",
    requiresConfirmation: true,
    writesData: false,
    writePolicy: "human_confirmation_required",
    missingFields,
    payload: {
      zoneId: zone ? cleanText(zone.id, 160) : "",
      zoneName: zone ? cleanText(zone.name, 160) : "",
      zoneLoc: zone ? cleanText(zone.location || zone.zoneLoc, 160) : "",
      kind: cleaningKindFromText(draft.rawText),
      photo: null,
      noPhotoReason: "דווח דרך עוזר AI ללא תמונה מצורפת",
      text: cleanText(draft.rawText, MAX_DESCRIPTION_CHARS),
      reportedById: actorId,
      reportedByName: actorName,
      reportedByRole: actorRole,
      at: createdAt,
      ai: {
        drafted: true,
        source: "ai_assist",
        draftVersion: Number(draft.version || 1)
      },
      log: [{
        at: createdAt,
        by: actorName,
        byRole: actorRole,
        text: "טיוטת דיווח ניקיון הוכנה על ידי AI וממתינה לאישור משתמש",
        kind: "ai_draft_cleaning_complaint"
      }]
    },
    execute: {
      method: "POST",
      path: "/api/cleaning/records",
      resource: "complaints",
      bodyField: "complaint"
    },
    safety: {
      deterministic: true,
      providerTextTrusted: false,
      serverMustRevalidate: true,
      auditRequired: true
    }
  };
}

function requestedMemoryFactFromText(text = "") {
  const raw = cleanText(text, MAX_DESCRIPTION_CHARS);
  if (!raw) return "";
  const match = raw.match(/(?:запомни|сохрани(?:\s+факт)?|важный\s+факт|remember|save(?:\s+this)?(?:\s+fact)?|important\s+fact|תזכור|זכור|שמור|חשוב\s+לזכור)\s*[:\-–—]?\s*(.+)$/iu);
  return match ? cleanText(match[1], 280) : "";
}

function buildAiMemoryFactCreateProposal({ draft = {}, user = {}, now = Date.now() } = {}) {
  const summary = requestedMemoryFactFromText(draft.rawText);
  if (!summary) return null;
  return {
    id: "create_memory_fact",
    type: "memory.fact.create",
    label: "שמירת זיכרון",
    status: "ready_for_confirmation",
    requiresConfirmation: true,
    writesData: false,
    writePolicy: "human_confirmation_required",
    missingFields: [],
    payload: {
      scopeType: "personal",
      summary,
      details: "",
      factType: "note",
      sourceType: "ai_chat",
      sourceLabel: "AI chat confirmation",
      confidence: "confirmed",
      requestedBy: cleanText(user.id || user.workerNo || user.name, 120),
      requestedAt: Number(now)
    },
    execute: {
      method: "POST",
      path: "/api/ai/memory",
      bodyField: "fact"
    },
    safety: {
      deterministic: true,
      providerTextTrusted: false,
      serverMustRevalidate: true,
      auditRequired: true
    }
  };
}

export function buildAiAssistActionProposals({ draft = {}, user = {}, now = Date.now(), context = {} } = {}) {
  const safeDraft = cleanObject(draft);
  const memoryProposal = buildAiMemoryFactCreateProposal({ draft: safeDraft, user, now });
  if (memoryProposal) return [memoryProposal];
  const requestedComment = requestedCommentFromText(safeDraft.rawText);
  if (requestedComment) {
    const commentProposal = buildAiTicketCommentProposal({ draft: safeDraft, context });
    return commentProposal ? [commentProposal] : [];
  }
  const updateProposal = buildAiTicketUpdateProposal({ draft: safeDraft, context });
  if (updateProposal) return [updateProposal];
  const taskUpdateProposal = buildAiTaskUpdateProposal({ draft: safeDraft, context, now });
  if (taskUpdateProposal) return [taskUpdateProposal];
  const meetingUpdateProposal = buildAiMeetingUpdateProposal({ draft: safeDraft, context, now });
  if (meetingUpdateProposal) return [meetingUpdateProposal];
  if (hasWaitingStatusIntent(safeDraft.rawText) && cleanArray(context.tickets).filter((ticket) => ticket && ticket.id).length === 1) return [];
  if (hasSupplierRoutingIntent(safeDraft.rawText) && cleanArray(context.tickets).filter((ticket) => ticket && ticket.id).length === 1) return [];
  if (hasUpdateIntent(safeDraft.rawText) && cleanArray(context.tickets).filter((ticket) => ticket && ticket.id).length > 0) return [];
  if (hasUpdateIntent(safeDraft.rawText) && cleanArray(context.tasks).filter((task) => task && task.id).length > 0) return [];
  if (hasUpdateIntent(safeDraft.rawText) && cleanArray(context.meetings).filter((meeting) => meeting && meeting.id).length > 0) return [];
  if (safeDraft.action === "draft_ppe_request") {
    const ppeProposal = buildAiPpeRequestCreateProposal({ draft: safeDraft, user, context });
    return ppeProposal ? [ppeProposal] : [];
  }
  if (safeDraft.action === "draft_cleaning_report") {
    const cleaningProposal = buildAiCleaningComplaintCreateProposal({ draft: safeDraft, user, context, now });
    return cleaningProposal ? [cleaningProposal] : [];
  }
  if (safeDraft.action === "draft_task") {
    if (hasMeetingCreateIntent(safeDraft.rawText)) {
      const payload = buildAiMeetingCreatePayload({ draft: safeDraft, user, now });
      const missingFields = missingFieldsForMeetingPayload(payload);
      return [{
        id: "create_meeting",
        type: "meeting.create",
        label: "יצירת פגישה",
        status: missingFields.length ? "needs_human_input" : "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        writePolicy: "human_confirmation_required",
        missingFields,
        payload,
        execute: {
          method: "POST",
          path: "/api/work",
          resource: "meetings",
          bodyField: "meeting"
        },
        safety: {
          deterministic: true,
          providerTextTrusted: false,
          serverMustRevalidate: true,
          auditRequired: true
        }
      }];
    }
    const payload = buildAiTaskCreatePayload({ draft: safeDraft, user, now });
    const missingFields = missingFieldsForTaskPayload(payload);
    return [{
      id: "create_task",
      type: "task.create",
      label: "יצירת משימה",
      status: missingFields.length ? "needs_human_input" : "ready_for_confirmation",
      requiresConfirmation: true,
      writesData: false,
      writePolicy: "human_confirmation_required",
      missingFields,
      payload,
      execute: {
        method: "POST",
        path: "/api/work",
        resource: "tasks",
        bodyField: "task"
      },
      safety: {
        deterministic: true,
        providerTextTrusted: false,
        serverMustRevalidate: true,
        auditRequired: true
      }
    }];
  }
  if (safeDraft.action !== "draft_ticket") return [];
  const payload = buildAiTicketCreatePayload({ draft: safeDraft, user, now, context });
  const missingFields = missingFieldsForTicketPayload(payload, safeDraft);
  const reviewInForm = shouldReviewTicketCreateInForm(payload, missingFields);
  const status = missingFields.length ? (reviewInForm ? "needs_form_review" : "needs_human_input") : "ready_for_confirmation";
  return [{
    id: "create_ticket",
    type: "ticket.create",
    label: "פתיחת קריאה",
    status,
    requiresConfirmation: true,
    writesData: false,
    writePolicy: "human_confirmation_required",
    missingFields,
    reviewMode: reviewInForm ? "ticket_form" : "",
    payload,
    execute: {
      method: "POST",
      path: "/api/tickets",
      bodyField: "ticket"
    },
    safety: {
      deterministic: true,
      providerTextTrusted: false,
      serverMustRevalidate: true,
      auditRequired: true
    }
  }];
}
