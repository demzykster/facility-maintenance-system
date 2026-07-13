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

const LOCATION_PATTERNS = [
  /(?:באזור|באיזור|במחלקת|במחסן|במבנה|בקו)\s+([^\n,.]+)/i,
  /(?:zone|area|department|warehouse|building)\s+([^\n,.]+)/i
];

function locationFromDraft(draft = {}) {
  const signalLocation = cleanText(draft.signals?.locationHint, 120);
  if (signalLocation) return signalLocation;
  const raw = cleanText(draft.rawText, MAX_DESCRIPTION_CHARS);
  const match = LOCATION_PATTERNS.map((pattern) => raw.match(pattern)).find(Boolean);
  return match ? cleanText(match[1], 120) : "";
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

function requestedStatusFromText(text = "") {
  const raw = cleanText(text, 500).toLowerCase();
  if (!raw) return "";
  if (/סטטוס|מצב|status|העבר|תעדכן|עדכן|change|update/i.test(raw)) {
    if (/בטיפול|בעבודה|בתהליך|in.?progress/i.test(raw)) return "in_progress";
    if (/חדשה|חדש|new/i.test(raw)) return "new";
    if (/ממתינ|המתנה|waiting/i.test(raw)) return "waiting";
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

function requestedTaskDueAtFromText(text = "", now = Date.now()) {
  const raw = cleanText(text, 800).toLowerCase();
  const base = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (!raw) return null;
  const inDays = raw.match(/(?:בעוד|תוך|in)\s+(\d{1,2})\s*(?:ימים|יום|days?|d\b)/i);
  if (inDays) return base + Number(inDays[1]) * DAY;
  if (/מחר|tomorrow/i.test(raw)) return base + DAY;
  if (/היום|today/i.test(raw)) return base;
  return null;
}

function hasMeetingCreateIntent(text = "") {
  return /פגישה|ישיבה|meeting/i.test(cleanText(text, 800));
}

function hasUpdateIntent(text = "") {
  return /תעדכן|עדכן|העבר|שנה|סיים|סגור|בטל|update|change|set|mark/i.test(cleanText(text, 800));
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
  const requestedStatus = requestedStatusFromText(draft.rawText);
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
  const requestedSupplier = requestedSupplierFromText(draft.rawText, context.suppliers);
  if (requestedSupplier && requestedSupplier !== ticket.supplier) patch.supplier = requestedSupplier;
  if (!Object.keys(patch).length) return null;
  const current = Object.fromEntries(Object.keys(patch).map((field) => [field, ticket[field]]));
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
  if (!Object.keys(patch).length) return null;
  const current = Object.fromEntries(Object.keys(patch).map((field) => [field, task[field]]));
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
      patch
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

export function buildAiTicketCreatePayload({ draft = {}, user = {}, now = Date.now() } = {}) {
  const module = cleanText(draft.module, 40);
  const track = ticketTrackForModule(module);
  const location = locationFromDraft(draft);
  const subject = subjectFromDraft(draft);
  const description = cleanText(draft.rawText, MAX_DESCRIPTION_CHARS);
  const priority = priorityFromSeverity(draft.severity);
  const createdAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const payload = {
    track,
    subject,
    category: ticketCategoryForModule(module),
    categoryLabel: "",
    priority,
    zone: location,
    asset: "",
    forkliftId: "",
    downtimeType: "",
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
  const at = requestedTaskDueAtFromText(draft.rawText, createdAt);
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

export function buildAiAssistActionProposals({ draft = {}, user = {}, now = Date.now(), context = {} } = {}) {
  const safeDraft = cleanObject(draft);
  const requestedComment = requestedCommentFromText(safeDraft.rawText);
  if (requestedComment) {
    const commentProposal = buildAiTicketCommentProposal({ draft: safeDraft, context });
    return commentProposal ? [commentProposal] : [];
  }
  const updateProposal = buildAiTicketUpdateProposal({ draft: safeDraft, context });
  if (updateProposal) return [updateProposal];
  const taskUpdateProposal = buildAiTaskUpdateProposal({ draft: safeDraft, context, now });
  if (taskUpdateProposal) return [taskUpdateProposal];
  if (hasWaitingStatusIntent(safeDraft.rawText) && cleanArray(context.tickets).filter((ticket) => ticket && ticket.id).length === 1) return [];
  if (hasSupplierRoutingIntent(safeDraft.rawText) && cleanArray(context.tickets).filter((ticket) => ticket && ticket.id).length === 1) return [];
  if (hasUpdateIntent(safeDraft.rawText) && cleanArray(context.tasks).filter((task) => task && task.id).length > 0) return [];
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
  const payload = buildAiTicketCreatePayload({ draft: safeDraft, user, now });
  const missingFields = missingFieldsForTicketPayload(payload, safeDraft);
  const status = missingFields.length ? "needs_human_input" : "ready_for_confirmation";
  return [{
    id: "create_ticket",
    type: "ticket.create",
    label: "פתיחת קריאה",
    status,
    requiresConfirmation: true,
    writesData: false,
    writePolicy: "human_confirmation_required",
    missingFields,
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
