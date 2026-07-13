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
