const cleanText = (value, limit = 240) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function canExecuteAiAssistAction(action = {}) {
  if (!action || typeof action !== "object") return false;
  if (action.type !== "ticket.create") return false;
  if (action.requiresConfirmation !== true) return false;
  if (action.execute?.method !== "POST" || action.execute?.path !== "/api/tickets") return false;
  if (Array.isArray(action.missingFields) && action.missingFields.length > 0) return false;
  return !!action.payload && typeof action.payload === "object";
}

export function prepareAiTicketCreateForSave(action = {}, actor = {}, options = {}) {
  if (!canExecuteAiAssistAction(action)) throw new Error("ai_action_not_executable");
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
