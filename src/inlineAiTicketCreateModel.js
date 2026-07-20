import { AI_ASSIST_WORKFLOWS } from "./aiAssistWorkflowModel.js";

const MANAGEMENT_ROLES = new Set(["admin", "executive", "user"]);

const cleanText = (value, limit = 240) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

export const INLINE_AI_TICKET_COPY = Object.freeze({
  title: "פתיחת קריאה בעזרת AI",
  subtitle: "תארו את התקלה בכמה מילים והעוזר יעזור לפתוח קריאה",
  welcome: "תארו בקצרה מה קרה. אפשר לציין מספר כלי, אזור או ציוד.",
  placeholder: "לדוגמה: במלגזה 123 לא עובד הצופר"
});

export function inlineAiTicketEffectiveAccess({ aiEnabled = false, session = {} } = {}) {
  const role = cleanText(session.role, 40).toLowerCase();
  const active = session.active !== false && !["inactive", "archived"].includes(cleanText(session.status, 40).toLowerCase());
  return Boolean(aiEnabled && active && MANAGEMENT_ROLES.has(role));
}

export function createInlineAiTicketInitialState() {
  return {
    msgs: [{ role: "assistant", content: INLINE_AI_TICKET_COPY.welcome }],
    input: "",
    busy: false,
    actionBusy: "",
    actionResults: {},
    createdTicket: null,
    error: ""
  };
}

export function inlineAiTicketRecentMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message, index) => !(index === 0 && message?.role === "assistant"))
    .filter((message) => ["user", "assistant"].includes(message?.role) && cleanText(message.content, 1000))
    .map((message) => ({ role: message.role, content: cleanText(message.content, 1000) }))
    .slice(-6);
}

export function buildInlineAiTicketRequest({
  text,
  messages = [],
  context,
  idempotencyKey = ""
} = {}) {
  const q = cleanText(text, 2000);
  if (!q) return null;
  return {
    text: q,
    messages: inlineAiTicketRecentMessages([...messages, { role: "user", content: q }]),
    context: {
      ...(context && typeof context === "object" && !Array.isArray(context) ? context : {}),
      intent: "create_ticket",
      uiSurface: "inline_ticket_create",
      taskSession: { type: "ticket_intake", transient: true },
      currentEntityHintOnly: true
    },
    workflow: AI_ASSIST_WORKFLOWS.ticketIntake,
    includeProviderPlan: true,
    idempotencyKey: cleanText(idempotencyKey, 200)
  };
}

export function beginInlineAiTicketSend(state = {}, { text, context, idempotencyKey } = {}) {
  const q = cleanText(text ?? state.input, 2000);
  if (!q || state.busy || state.createdTicket) return { state, request: null };
  const request = buildInlineAiTicketRequest({
    text: q,
    messages: state.msgs || [],
    context,
    idempotencyKey
  });
  if (!request) return { state, request: null };
  return {
    request,
    state: {
      ...state,
      input: "",
      busy: true,
      error: "",
      msgs: [...(state.msgs || []), { role: "user", content: q }]
    }
  };
}

export function inlineAiTicketFromCapabilityResponse(output = {}) {
  const capabilityResponse = output?.capabilityResponse && typeof output.capabilityResponse === "object"
    ? output.capabilityResponse
    : null;
  const result = capabilityResponse?.actionResult && typeof capabilityResponse.actionResult === "object"
    ? capabilityResponse.actionResult
    : null;
  if (!result?.ticketId) return null;
  return {
    id: cleanText(result.ticketId, 160),
    track: cleanText(result.track, 40) || "transport",
    ticketNo: cleanText(result.ticketNumber || result.ticketNo, 80),
    num: result.num,
    subject: cleanText(result.subject || output?.draft?.subject, 160),
    description: cleanText(result.description || output?.draft?.description, 500),
    asset: cleanText(result.asset || result.forkliftCode || result.forkliftId, 160),
    source: "server"
  };
}

export function inlineAiTicketActionMode(action = {}) {
  if (action?.type !== "ticket.create") return "ignore";
  if (Array.isArray(action.missingFields) && action.missingFields.length) return "needs_input";
  if (action.status === "needs_form_review" || action.reviewMode === "ticket_form") return "form";
  return "confirm";
}

export function completeInlineAiTicketSend(state = {}, output = {}) {
  const text = cleanText(output?.text || output?.assistant?.text || output?.draft?.userReply, 4000) || "הכנתי תשובה קצרה.";
  const actions = Array.isArray(output?.actions) ? output.actions.filter((action) => action && typeof action === "object") : [];
  const createdTicket = inlineAiTicketFromCapabilityResponse(output);
  return {
    ...state,
    busy: false,
    createdTicket: createdTicket || state.createdTicket || null,
    msgs: [...(state.msgs || []), {
      role: "assistant",
      content: text,
      actions,
      capabilityResponse: output?.capabilityResponse || null
    }]
  };
}

export function failInlineAiTicketSend(state = {}, error = {}) {
  const code = cleanText(error?.message || error, 200);
  return {
    ...state,
    busy: false,
    error: code || "inline_ai_ticket_failed",
    msgs: [...(state.msgs || []), {
      role: "assistant",
      content: "לא הצלחתי להשלים את הבדיקה כרגע. אפשר לנסות שוב או לפתוח קריאה בטופס הרגיל."
    }]
  };
}
