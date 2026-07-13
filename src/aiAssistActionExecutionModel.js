const cleanText = (value, limit = 240) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const AI_TICKET_UPDATE_ALLOWED_FIELDS = Object.freeze([
  "priority",
  "status",
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

const normalizeComparable = (value) => value == null ? "" : value;

function hasMissingFields(action = {}) {
  return Array.isArray(action.missingFields) && action.missingFields.length > 0;
}

function hasTicketsApiExecuteContract(action = {}) {
  return action.execute?.method === "POST" && action.execute?.path === "/api/tickets";
}

export function canExecuteAiAssistAction(action = {}) {
  if (!action || typeof action !== "object") return false;
  if (action.requiresConfirmation !== true) return false;
  if (!hasTicketsApiExecuteContract(action)) return false;
  if (hasMissingFields(action)) return false;
  if (!action.payload || typeof action.payload !== "object" || Array.isArray(action.payload)) return false;
  const payload = cleanObject(action.payload);
  if (action.type === "ticket.create") return true;
  if (action.type === "ticket.update") {
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
    if (before === after) continue;
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
    priority: cleanText(payload.priority, 40) || "medium",
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
