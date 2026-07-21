import { waitingTargetRequirementForReason } from "./ticketWaitingTargetModel.js";

const cleanText = (value, limit = 240) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const AI_TICKET_UPDATE_ALLOWED_FIELDS = Object.freeze([
  "priority",
  "status",
  "waitingReason",
  "waitBall",
  "waitingTargetType",
  "waitingSupplier",
  "waitingUser",
  "waitingUntil",
  "assignee",
  "supplier",
  "description",
  "zone",
  "asset",
  "forkliftId",
  "downtimeType",
  "incidentShift",
  "driverInvolved",
  "driverInvolvedId"
]);
const AI_TASK_UPDATE_ALLOWED_FIELDS = Object.freeze([
  "priority",
  "status",
  "dueAt",
  "responsibleIds"
]);
const AI_MEETING_UPDATE_ALLOWED_FIELDS = Object.freeze([
  "at"
]);
const AI_WAITING_TARGET_CLEAR_FIELDS = Object.freeze([
  "waitingTargetType",
  "waitingSupplier",
  "waitingUser",
  "waitingUntil"
]);

const normalizeComparable = (value) => value == null ? "" : value;

function hasMissingFields(action = {}) {
  return Array.isArray(action.missingFields) && action.missingFields.length > 0;
}

function hasTicketsApiExecuteContract(action = {}) {
  return action.execute?.method === "POST" && action.execute?.path === "/api/tickets";
}

function hasTasksApiExecuteContract(action = {}) {
  return action.execute?.method === "POST"
    && action.execute?.path === "/api/work"
    && action.execute?.resource === "tasks"
    && action.execute?.bodyField === "task";
}

function hasMeetingsApiExecuteContract(action = {}) {
  return action.execute?.method === "POST"
    && action.execute?.path === "/api/work"
    && action.execute?.resource === "meetings"
    && action.execute?.bodyField === "meeting";
}

function hasPpeRequestsApiExecuteContract(action = {}) {
  return action.execute?.method === "POST"
    && action.execute?.path === "/api/ppe"
    && action.execute?.resource === "requests"
    && action.execute?.bodyField === "request";
}

function hasCleaningComplaintsApiExecuteContract(action = {}) {
  return action.execute?.method === "POST"
    && action.execute?.path === "/api/cleaning/records"
    && action.execute?.resource === "complaints"
    && action.execute?.bodyField === "complaint";
}

function hasAiMemoryApiExecuteContract(action = {}) {
  return action.execute?.method === "POST"
    && action.execute?.path === "/api/ai/memory"
    && action.execute?.bodyField === "fact";
}

export function canExecuteAiAssistAction(action = {}) {
  if (!action || typeof action !== "object") return false;
  if (action.requiresConfirmation !== true) return false;
  if (hasMissingFields(action)) return false;
  if (!action.payload || typeof action.payload !== "object" || Array.isArray(action.payload)) return false;
  const payload = cleanObject(action.payload);
  if (action.type === "task.create") {
    return hasTasksApiExecuteContract(action) && !!cleanText(payload.title, 200);
  }
  if (action.type === "meeting.create") {
    return hasMeetingsApiExecuteContract(action)
      && !!cleanText(payload.title, 200)
      && Number.isFinite(Number(payload.at));
  }
  if (action.type === "meeting.update") {
    return hasMeetingsApiExecuteContract(action)
      && !!cleanText(payload.meetingId, 160)
      && !!payload.patch
      && typeof payload.patch === "object"
      && !Array.isArray(payload.patch);
  }
  if (action.type === "task.update") {
    return hasTasksApiExecuteContract(action)
      && !!cleanText(payload.taskId, 160)
      && !!payload.patch
      && typeof payload.patch === "object"
      && !Array.isArray(payload.patch);
  }
  if (action.type === "ppe.request.create") {
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    return hasPpeRequestsApiExecuteContract(action)
      && !!cleanText(payload.workerId, 160)
      && !!cleanText(payload.workerName, 160)
      && lines.length > 0
      && lines.every((line) => !!cleanText(line?.itemId, 160)
        && !!cleanText(line?.itemName, 160)
        && !!cleanText(line?.size, 80)
        && Number(line?.qty || 0) > 0);
  }
  if (action.type === "cleaning.complaint.create") {
    return hasCleaningComplaintsApiExecuteContract(action)
      && !!cleanText(payload.zoneId, 160)
      && !!cleanText(payload.zoneName, 160)
      && !!cleanText(payload.kind, 40)
      && !!cleanText(payload.text || payload.noPhotoReason, 1000);
  }
  if (action.type === "memory.fact.create") {
    return hasAiMemoryApiExecuteContract(action) && !!cleanText(payload.summary, 280);
  }
  if (!hasTicketsApiExecuteContract(action)) return false;
  if (action.type === "ticket.create") return !!cleanText(payload.priority, 40);
  if (action.type === "ticket.update") {
    const patch = cleanObject(payload.patch);
    if (Object.prototype.hasOwnProperty.call(patch, "waitingReason")
      && waitingTargetRequirementForReason(patch.waitingReason).required) return false;
    const writesWaitingTarget = AI_WAITING_TARGET_CLEAR_FIELDS.some((field) => {
      if (!Object.prototype.hasOwnProperty.call(patch, field)) return false;
      if (field === "waitingTargetType") return ![null, "", "none"].includes(patch[field]);
      return patch[field] !== null && patch[field] !== "";
    });
    if (writesWaitingTarget) return false;
    return !!cleanText(payload.ticketId, 160)
      && !!payload.patch
      && typeof payload.patch === "object"
      && !Array.isArray(payload.patch);
  }
  if (action.type === "ticket.comment") {
    return !!cleanText(payload.ticketId, 160) && !!cleanText(payload.note, 1000);
  }
  return false;
}

export function prepareAiMeetingUpdateForSave(action = {}, existingMeeting = {}, actor = {}, options = {}) {
  if (!canExecuteAiAssistAction(action) || action.type !== "meeting.update") throw new Error("ai_action_not_executable");
  const payload = cleanObject(action.payload);
  const patch = cleanObject(payload.patch);
  const meetingId = cleanText(payload.meetingId, 160);
  const existingId = cleanText(existingMeeting.id, 160);
  if (!meetingId || !existingId || meetingId !== existingId) throw new Error("ai_action_meeting_mismatch");
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const changes = [];
  const nextPatch = {};
  for (const field of AI_MEETING_UPDATE_ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    const before = normalizeComparable(existingMeeting[field]);
    const after = normalizeComparable(patch[field]);
    if (before === after) continue;
    nextPatch[field] = patch[field];
    changes.push({ field, before, after });
  }
  if (!changes.length) throw new Error("ai_action_no_allowed_changes");
  const actorName = cleanText(actor.name, 120) || "AI";
  const actorRole = cleanText(actor.role, 40);
  const changedFields = changes.map((change) => change.field).join(", ");
  return {
    meeting: {
      ...existingMeeting,
      ...nextPatch,
      id: existingMeeting.id,
      updatedAt: now,
      ai: {
        ...cleanObject(existingMeeting.ai),
        source: "ai_assist",
        lastConfirmedAction: cleanText(action.id, 120),
        lastConfirmedAt: now
      },
      log: [
        ...(Array.isArray(existingMeeting.log) ? existingMeeting.log : []),
        {
          at: now,
          by: actorName,
          byRole: actorRole,
          text: `משתמש אישר עדכון פגישה שהוכן על ידי AI: ${changedFields}`,
          kind: "ai_confirmed_meeting_update"
        }
      ]
    },
    changes
  };
}

export function prepareAiMeetingCreateForSave(action = {}, actor = {}, options = {}) {
  if (!canExecuteAiAssistAction(action) || action.type !== "meeting.create") throw new Error("ai_action_not_executable");
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const makeId = typeof options.makeId === "function" ? options.makeId : () => `ai-meeting-${now.toString(36)}`;
  const payload = cleanObject(action.payload);
  const actorId = cleanText(actor.id || actor.authUserId || actor.workerNo, 120);
  const actorName = cleanText(actor.name, 120) || "AI";
  const actorRole = cleanText(actor.role, 40);
  const id = cleanText(payload.id || makeId(), 160);
  if (!id) throw new Error("ai_action_meeting_id_required");
  const participantIds = Array.isArray(payload.participantIds)
    ? payload.participantIds.map((value) => cleanText(value, 160)).filter(Boolean)
    : [];
  return {
    ...payload,
    id,
    title: cleanText(payload.title, 200),
    type: cleanText(payload.type, 40) || "boss",
    purpose: cleanText(payload.purpose, 1600),
    at: Number(payload.at),
    participantIds: participantIds.length ? participantIds : (actorId ? [actorId] : []),
    agenda: cleanText(payload.agenda, 1600),
    decisions: cleanText(payload.decisions, 1600),
    recur: cleanText(payload.recur, 40) || null,
    standingTopics: Array.isArray(payload.standingTopics) ? payload.standingTopics : [],
    topicMarks: cleanObject(payload.topicMarks),
    status: cleanText(payload.status, 40) || "planned",
    ownerId: cleanText(payload.ownerId, 160) || actorId,
    createdAt: Number.isFinite(Number(payload.createdAt)) ? Number(payload.createdAt) : now,
    updatedAt: now,
    ai: {
      ...cleanObject(payload.ai),
      drafted: true,
      source: "ai_assist",
      confirmedByHuman: true,
      confirmedAt: now,
      actionId: cleanText(action.id, 120)
    },
    log: [
      ...(Array.isArray(payload.log) ? payload.log : []),
      {
        at: now,
        by: actorName,
        byRole: actorRole,
        text: "משתמש אישר יצירת פגישה שהוכנה על ידי AI",
        kind: "ai_confirmed_meeting"
      }
    ]
  };
}

export function prepareAiTaskUpdateForSave(action = {}, existingTask = {}, actor = {}, options = {}) {
  if (!canExecuteAiAssistAction(action) || action.type !== "task.update") throw new Error("ai_action_not_executable");
  const payload = cleanObject(action.payload);
  const patch = cleanObject(payload.patch);
  const taskId = cleanText(payload.taskId, 160);
  const existingId = cleanText(existingTask.id, 160);
  if (!taskId || !existingId || taskId !== existingId) throw new Error("ai_action_task_mismatch");
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const changes = [];
  const nextPatch = {};
  for (const field of AI_TASK_UPDATE_ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    const before = normalizeComparable(existingTask[field]);
    const after = Array.isArray(patch[field]) ? patch[field].map((value) => cleanText(value, 160)).filter(Boolean) : normalizeComparable(patch[field]);
    const beforeComparable = Array.isArray(before) ? before.join("|") : before;
    const afterComparable = Array.isArray(after) ? after.join("|") : after;
    if (beforeComparable === afterComparable) continue;
    nextPatch[field] = after;
    changes.push({ field, before, after });
  }
  if (!changes.length) throw new Error("ai_action_no_allowed_changes");
  const actorName = cleanText(actor.name, 120) || "AI";
  const actorRole = cleanText(actor.role, 40);
  const changedFields = changes.map((change) => change.field).join(", ");
  return {
    task: {
      ...existingTask,
      ...nextPatch,
      id: existingTask.id,
      updatedAt: now,
      ai: {
        ...cleanObject(existingTask.ai),
        source: "ai_assist",
        lastConfirmedAction: cleanText(action.id, 120),
        lastConfirmedAt: now
      },
      log: [
        ...(Array.isArray(existingTask.log) ? existingTask.log : []),
        {
          at: now,
          by: actorName,
          byRole: actorRole,
          text: `משתמש אישר עדכון משימה שהוכן על ידי AI: ${changedFields}`,
          kind: "ai_confirmed_task_update"
        }
      ]
    },
    changes
  };
}

export function prepareAiTaskCreateForSave(action = {}, actor = {}, options = {}) {
  if (!canExecuteAiAssistAction(action) || action.type !== "task.create") throw new Error("ai_action_not_executable");
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const makeId = typeof options.makeId === "function" ? options.makeId : () => `ai-task-${now.toString(36)}`;
  const payload = cleanObject(action.payload);
  const actorId = cleanText(actor.id || actor.authUserId || actor.workerNo, 120);
  const actorName = cleanText(actor.name, 120) || "AI";
  const actorRole = cleanText(actor.role, 40);
  const id = cleanText(payload.id || makeId(), 160);
  if (!id) throw new Error("ai_action_task_id_required");
  const responsibleIds = Array.isArray(payload.responsibleIds)
    ? payload.responsibleIds.map((value) => cleanText(value, 160)).filter(Boolean)
    : [];
  return {
    ...payload,
    id,
    title: cleanText(payload.title, 200),
    desc: cleanText(payload.desc, 1600),
    status: cleanText(payload.status, 40) || "todo",
    priority: cleanText(payload.priority, 40) || "medium",
    sourceModule: cleanText(payload.sourceModule, 80) || "ai_assist",
    ownerId: cleanText(payload.ownerId, 160) || actorId,
    responsibleIds: responsibleIds.length ? responsibleIds : (actorId ? [actorId] : []),
    participantIds: Array.isArray(payload.participantIds) ? payload.participantIds.map((value) => cleanText(value, 160)).filter(Boolean) : [],
    createdAt: Number.isFinite(Number(payload.createdAt)) ? Number(payload.createdAt) : now,
    updatedAt: now,
    ai: {
      ...cleanObject(payload.ai),
      drafted: true,
      source: "ai_assist",
      confirmedByHuman: true,
      confirmedAt: now,
      actionId: cleanText(action.id, 120)
    },
    log: [
      ...(Array.isArray(payload.log) ? payload.log : []),
      {
        at: now,
        by: actorName,
        byRole: actorRole,
        text: "משתמש אישר יצירת משימה שהוכנה על ידי AI",
        kind: "ai_confirmed_task"
      }
    ]
  };
}

export function prepareAiPpeRequestCreateForSave(action = {}, actor = {}, options = {}) {
  if (!canExecuteAiAssistAction(action) || action.type !== "ppe.request.create") throw new Error("ai_action_not_executable");
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const makeId = typeof options.makeId === "function" ? options.makeId : () => `ai-ppe-${now.toString(36)}`;
  const payload = cleanObject(action.payload);
  const id = cleanText(payload.id || makeId(), 160);
  if (!id) throw new Error("ai_action_ppe_request_id_required");
  const actorName = cleanText(actor.name, 120) || "AI";
  const actorRole = cleanText(actor.role, 40);
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  return {
    id,
    status: "pending",
    awaitWorkerSign: false,
    workerId: cleanText(payload.workerId, 160),
    workerName: cleanText(payload.workerName, 160),
    workerNo: cleanText(payload.workerNo, 80),
    dept: cleanText(payload.dept || payload.department, 120),
    lines: lines.map((line) => {
      const qty = Math.max(1, Number.parseInt(line?.qty || "1", 10) || 1);
      return {
        itemId: cleanText(line?.itemId, 160),
        itemName: cleanText(line?.itemName, 160),
        category: cleanText(line?.category, 80),
        size: cleanText(line?.size, 80),
        qty,
        workerCharge: 0,
        chargeReason: "",
        clawbackEligible: false,
        unitCost: 0,
        retPrev: false,
        returnRequested: false
      };
    }),
    note: cleanText(payload.note, 1000),
    signature: "",
    by: {
      id: cleanText(actor.id || actor.authUserId || actor.workerNo, 160),
      name: actorName
    },
    at: now,
    ai: {
      drafted: true,
      source: "ai_assist",
      confirmedByHuman: true,
      confirmedAt: now,
      actionId: cleanText(action.id, 120)
    },
    log: [{
      at: now,
      by: actorName,
      byRole: actorRole,
      text: "משתמש אישר בקשת ביגוד שהוכנה על ידי AI",
      kind: "ai_confirmed_ppe_request"
    }]
  };
}

export function prepareAiCleaningComplaintCreateForSave(action = {}, actor = {}, options = {}) {
  if (!canExecuteAiAssistAction(action) || action.type !== "cleaning.complaint.create") throw new Error("ai_action_not_executable");
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const makeId = typeof options.makeId === "function" ? options.makeId : () => `ai-cleaning-${now.toString(36)}`;
  const payload = cleanObject(action.payload);
  const id = cleanText(payload.id || makeId(), 160);
  if (!id) throw new Error("ai_action_cleaning_complaint_id_required");
  const actorName = cleanText(actor.name, 120) || "AI";
  const actorRole = cleanText(actor.role, 40);
  return {
    id,
    zoneId: cleanText(payload.zoneId, 160),
    zoneName: cleanText(payload.zoneName, 160),
    zoneLoc: cleanText(payload.zoneLoc || payload.location, 160),
    kind: cleanText(payload.kind, 40) || "dirty",
    photo: null,
    noPhotoReason: cleanText(payload.noPhotoReason, 500) || "דווח דרך עוזר AI ללא תמונה מצורפת",
    text: cleanText(payload.text, 1000),
    reportedById: cleanText(payload.reportedById || actor.id || actor.authUserId || actor.workerNo, 160),
    reportedByName: cleanText(payload.reportedByName || actorName, 120),
    reportedByRole: cleanText(payload.reportedByRole || actorRole, 40),
    at: Number.isFinite(Number(payload.at)) ? Number(payload.at) : now,
    ai: {
      ...cleanObject(payload.ai),
      drafted: true,
      source: "ai_assist",
      confirmedByHuman: true,
      confirmedAt: now,
      actionId: cleanText(action.id, 120)
    },
    log: [
      ...(Array.isArray(payload.log) ? payload.log : []),
      {
        at: now,
        by: actorName,
        byRole: actorRole,
        text: "משתמש אישר דיווח ניקיון שהוכן על ידי AI",
        kind: "ai_confirmed_cleaning_complaint"
      }
    ]
  };
}

export function prepareAiTicketCreateForSave(action = {}, actor = {}, options = {}) {
  if (!canExecuteAiAssistAction(action) || action.type !== "ticket.create") throw new Error("ai_action_not_executable");
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const makeId = typeof options.makeId === "function" ? options.makeId : () => `ai-${now.toString(36)}`;
  const payload = cleanObject(action.payload);
  const id = cleanText(payload.id || makeId(), 160);
  if (!id) throw new Error("ai_action_ticket_id_required");
  const actorName = cleanText(actor.name, 120) || "AI";
  const actorRole = cleanText(actor.role, 40);
  return {
    ...payload,
    id,
    status: cleanText(payload.status, 40) || "new",
    createdAt: Number.isFinite(Number(payload.createdAt)) ? Number(payload.createdAt) : now,
    updatedAt: now,
    ai: {
      ...cleanObject(payload.ai),
      drafted: true,
      source: "ai_assist",
      confirmedByHuman: true,
      confirmedAt: now,
      actionId: cleanText(action.id, 120)
    },
    log: [
      ...(Array.isArray(payload.log) ? payload.log : []),
      {
        at: now,
        by: actorName,
        byRole: actorRole,
        text: "משתמש אישר יצירת קריאה שהוכנה על ידי AI",
        kind: "ai_confirmed"
      }
    ]
  };
}

export function prepareAiTicketUpdateForSave(action = {}, existingTicket = {}, actor = {}, options = {}) {
  if (!canExecuteAiAssistAction(action) || action.type !== "ticket.update") throw new Error("ai_action_not_executable");
  const payload = cleanObject(action.payload);
  const patch = cleanObject(payload.patch);
  const ticketId = cleanText(payload.ticketId, 160);
  const existingId = cleanText(existingTicket.id, 160);
  if (!ticketId || !existingId || ticketId !== existingId) throw new Error("ai_action_ticket_mismatch");
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const changes = [];
  const nextPatch = {};
  for (const field of AI_TICKET_UPDATE_ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    const before = normalizeComparable(existingTicket[field]);
    const after = normalizeComparable(patch[field]);
    const materializesWaitingTargetClear = AI_WAITING_TARGET_CLEAR_FIELDS.includes(field)
      && patch[field] === null
      && !Object.prototype.hasOwnProperty.call(existingTicket, field);
    if (before === after && !materializesWaitingTargetClear) continue;
    nextPatch[field] = patch[field];
    changes.push({ field, before, after });
  }
  if (!changes.length) throw new Error("ai_action_no_allowed_changes");
  const actorName = cleanText(actor.name, 120) || "AI";
  const actorRole = cleanText(actor.role, 40);
  const changedFields = changes.map((change) => change.field).join(", ");
  return {
    ticket: {
      ...existingTicket,
      ...nextPatch,
      id: existingTicket.id,
      updatedAt: now,
      ai: {
        ...cleanObject(existingTicket.ai),
        source: "ai_assist",
        lastConfirmedAction: cleanText(action.id, 120),
        lastConfirmedAt: now
      },
      log: [
        ...(Array.isArray(existingTicket.log) ? existingTicket.log : []),
        {
          at: now,
          by: actorName,
          byRole: actorRole,
          text: `משתמש אישר עדכון קריאה שהוכן על ידי AI: ${changedFields}`,
          kind: "ai_confirmed_update"
        }
      ]
    },
    changes
  };
}

export function prepareAiTicketCommentForSave(action = {}, existingTicket = {}, actor = {}, options = {}) {
  if (!canExecuteAiAssistAction(action) || action.type !== "ticket.comment") throw new Error("ai_action_not_executable");
  const payload = cleanObject(action.payload);
  const ticketId = cleanText(payload.ticketId, 160);
  const existingId = cleanText(existingTicket.id, 160);
  if (!ticketId || !existingId || ticketId !== existingId) throw new Error("ai_action_ticket_mismatch");
  const note = cleanText(payload.note, 1000);
  if (!note) throw new Error("ai_action_comment_required");
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const actorName = cleanText(actor.name, 120) || "AI";
  const actorRole = cleanText(actor.role, 40);
  return {
    ticket: {
      ...existingTicket,
      id: existingTicket.id,
      updatedAt: now,
      ai: {
        ...cleanObject(existingTicket.ai),
        source: "ai_assist",
        lastConfirmedAction: cleanText(action.id, 120),
        lastConfirmedAt: now
      },
      log: [
        ...(Array.isArray(existingTicket.log) ? existingTicket.log : []),
        {
          at: now,
          by: actorName,
          byRole: actorRole,
          text: `משתמש אישר הערה שהוכנה על ידי AI: ${note}`,
          kind: "ai_confirmed_comment"
        }
      ]
    },
    note
  };
}

export function ticketPrefillFromAiAssistAction(action = {}) {
  if (!action || action.type !== "ticket.create") return null;
  const payload = cleanObject(action.payload);
  if (!payload || typeof payload !== "object") return null;
  return {
    track: cleanText(payload.track, 40) || null,
    subject: cleanText(payload.subject, 160),
    category: cleanText(payload.category, 80),
    priority: cleanText(payload.priority, 40),
    zone: cleanText(payload.zone || payload.location, 160),
    asset: cleanText(payload.asset, 160),
    forkliftId: cleanText(payload.forkliftId, 160),
    downtimeType: cleanText(payload.downtimeType, 80),
    incidentShift: cleanText(payload.incidentShift, 80),
    driverInvolved: cleanText(payload.driverInvolved, 160),
    driverInvolvedId: cleanText(payload.driverInvolvedId, 160),
    description: cleanText(payload.description, 1600)
  };
}
