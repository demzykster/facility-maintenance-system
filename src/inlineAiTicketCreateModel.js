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
  placeholder: "תארו בקצרה את התקלה",
  facilityLocationPlaceholder: "לדוגמה: משרדי הפצה",
  transportAssetPlaceholder: "לדוגמה: מלגזה 210"
});

const INTAKE_DOMAINS = new Set(["facility", "transport", "unresolved"]);
const FIELD_ALIASES = Object.freeze({
  zone: "location",
  location: "location",
  forkliftId: "asset",
  asset: "asset",
  downtimeType: "downtimeType"
});

function cleanTicketPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return {
    track: cleanText(payload.track, 40),
    subject: cleanText(payload.subject, 160),
    category: cleanText(payload.category, 80),
    priority: cleanText(payload.priority, 40),
    zone: cleanText(payload.zone || payload.location, 160),
    asset: cleanText(payload.asset, 160),
    forkliftId: cleanText(payload.forkliftId, 160),
    downtimeType: cleanText(payload.downtimeType, 80),
    description: cleanText(payload.description, 1000)
  };
}

export function normalizeInlineTicketIntakeState(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const domain = cleanText(value.domain, 40);
  if (!INTAKE_DOMAINS.has(domain)) return null;
  const rawField = cleanText(value.pendingField, 80);
  const pendingField = FIELD_ALIASES[rawField] || "";
  const draft = cleanTicketPayload(value.draft || value.payload || {});
  const status = cleanText(value.status, 40) || (pendingField ? "pending" : "ready");
  return {
    intakeId: cleanText(value.intakeId, 120),
    domain,
    pendingField,
    draft,
    status
  };
}

export function inlineTicketIntakeStateFromActions(actions = [], previous = null) {
  const ticketAction = (Array.isArray(actions) ? actions : [])
    .find((action) => action?.type === "ticket.create" && action.payload && typeof action.payload === "object");
  if (!ticketAction) return previous || null;
  const payload = cleanTicketPayload(ticketAction.payload);
  const domain = payload.track === "facility" || payload.track === "transport" ? payload.track : "unresolved";
  const missingFields = Array.isArray(ticketAction.missingFields)
    ? ticketAction.missingFields.map((field) => FIELD_ALIASES[cleanText(field, 80)] || "").filter(Boolean)
    : [];
  const status = missingFields.length ? "pending" : (ticketAction.status === "needs_form_review" ? "ready_for_form" : "ready");
  return normalizeInlineTicketIntakeState({
    intakeId: ticketAction.id || previous?.intakeId || "create_ticket",
    domain,
    pendingField: missingFields[0] || "",
    draft: payload,
    status
  });
}

export function inlineAiTicketPlaceholder(state = {}) {
  const intake = normalizeInlineTicketIntakeState(state?.intake);
  if (intake?.domain === "facility" && intake.pendingField === "location") return INLINE_AI_TICKET_COPY.facilityLocationPlaceholder;
  if (intake?.domain === "transport" && intake.pendingField === "asset") return INLINE_AI_TICKET_COPY.transportAssetPlaceholder;
  return INLINE_AI_TICKET_COPY.placeholder;
}

export function inlineAiTicketEffectiveAccess({ aiEnabled = false, session = {} } = {}) {
  const role = cleanText(session.role, 40).toLowerCase();
  const active = session.active !== false && !["inactive", "archived"].includes(cleanText(session.status, 40).toLowerCase());
  return Boolean(aiEnabled && active && MANAGEMENT_ROLES.has(role));
}

export function createInlineAiTicketInitialState() {
  return {
    msgs: [{ role: "assistant", content: INLINE_AI_TICKET_COPY.welcome }],
    input: "",
    intake: null,
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
  intake = null,
  idempotencyKey = ""
} = {}) {
  const q = cleanText(text, 2000);
  if (!q) return null;
  const normalizedIntake = normalizeInlineTicketIntakeState(intake);
  return {
    text: q,
    messages: inlineAiTicketRecentMessages([...messages, { role: "user", content: q }]),
    context: {
      ...(context && typeof context === "object" && !Array.isArray(context) ? context : {}),
      intent: "create_ticket",
      uiSurface: "inline_ticket_create",
      taskSession: {
        type: "ticket_intake",
        transient: true,
        ...(normalizedIntake ? { intake: normalizedIntake } : {})
      },
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
    intake: state.intake,
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
  if (action.status === "needs_form_review" || action.reviewMode === "ticket_form") return "form";
  if (Array.isArray(action.missingFields) && action.missingFields.length) return "needs_input";
  return "confirm";
}

export function inlineAiTicketVisibleActions(actions = []) {
  return (Array.isArray(actions) ? actions : [])
    .filter((action) => ["confirm", "form"].includes(inlineAiTicketActionMode(action)));
}

export function inlineAiTicketPrimaryActionLabel(action = {}) {
  const mode = inlineAiTicketActionMode(action);
  if (mode === "form") return "המשך לטופס הקריאה";
  return "אישור ויצירת קריאה";
}

export function completeInlineAiTicketSend(state = {}, output = {}) {
  const text = cleanText(output?.text || output?.assistant?.text || output?.draft?.userReply, 4000) || "הכנתי תשובה קצרה.";
  const allActions = Array.isArray(output?.actions) ? output.actions.filter((action) => action && typeof action === "object") : [];
  const actions = inlineAiTicketVisibleActions(
    allActions
  );
  const createdTicket = inlineAiTicketFromCapabilityResponse(output);
  const intake = createdTicket ? null : inlineTicketIntakeStateFromActions(allActions, state.intake);
  return {
    ...state,
    busy: false,
    intake,
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
