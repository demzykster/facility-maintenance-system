import { AI_ASSIST_WORKFLOWS } from "./aiAssistWorkflowModel.js";
import { aiAssistWelcomeMessage } from "./aiAssistQuickPromptModel.js";

const cleanText = (value, fallback = "") => String(value || fallback || "").trim();

export function normalizeAiPanelAssistantOutput(output) {
  if (typeof output === "string") return { text: output, actions: [], memoryCitations: [], memoryGrounding: null, providerPlan: null, providerPlanErrorCode: "" };
  const text = cleanText(output?.text || output?.assistant?.text || output?.draft?.userReply, "לא התקבלה תשובה.");
  const actions = Array.isArray(output?.actions) ? output.actions.filter((action) => action && typeof action === "object") : [];
  const memoryCitations = Array.isArray(output?.memoryCitations)
    ? output.memoryCitations.filter((citation) => citation && typeof citation === "object")
    : Array.isArray(output?.assistant?.memoryCitations) ? output.assistant.memoryCitations.filter((citation) => citation && typeof citation === "object") : [];
  const memoryGrounding = output?.memoryGrounding && typeof output.memoryGrounding === "object"
    ? output.memoryGrounding
    : output?.assistant?.memoryGrounding && typeof output.assistant.memoryGrounding === "object" ? output.assistant.memoryGrounding : null;
  const providerPlan = output?.providerPlan && typeof output.providerPlan === "object" ? output.providerPlan : null;
  const providerPlanErrorCode = cleanText(output?.providerPlanErrorCode, "");
  return { text, actions, memoryCitations, memoryGrounding, providerPlan, providerPlanErrorCode };
}

export function shouldRequestProviderPlan(workflow = AI_ASSIST_WORKFLOWS.general) {
  return [
    AI_ASSIST_WORKFLOWS.riskSummary,
    AI_ASSIST_WORKFLOWS.nextActions,
    AI_ASSIST_WORKFLOWS.draftPreparation
  ].includes(workflow);
}

export function aiAssistantFailureMessage(error = {}) {
  const code = cleanText(error?.message || error, "");
  if (code === "ai_server_disabled") return "שרת ה-AI כבוי כרגע. יש להגדיר ב-Vercel את CMMS_AI_MODE=server, ספק ומפתח API.";
  if (code === "ai_provider_required") return "חסר ספק AI בשרת. יש לבחור ספק ולהגדיר CMMS_AI_PROVIDER.";
  if (code === "ai_provider_key_required") return "חסר מפתח API לספק ה-AI בשרת / Vercel env.";
  if (code === "ai_provider_failed") return "השרת מחובר ל-AI, אבל ספק המודל החזיר שגיאה. בדקו את המפתח או המודל.";
  if (code === "ai_provider_quota_exceeded") return "השרת מחובר ל-AI, אבל מכסת ספק ה-AI / החיוב בחשבון לא מאפשרים כרגע להריץ את המודל.";
  if (code === "ai_provider_model_unavailable") return "השרת מחובר ל-AI, אבל המודל שהוגדר אינו זמין לחשבון הזה.";
  if (code === "ai_provider_auth_failed") return "השרת מחובר ל-AI, אבל מפתח הספק נדחה. בדקו את המפתח ב-Vercel.";
  if (code === "ai_provider_rate_limited") return "ספק ה-AI מגביל כרגע את קצב הבקשות. נסו שוב בעוד רגע.";
  if (code === "ai_assist_rate_limited") return "נשלחו יותר מדי בקשות AI ברצף. נסו שוב בעוד רגע.";
  if (code === "access_token_required") return "נדרשת התחברות מחדש לפני שימוש ב-AI.";
  return "לא הצלחתי להתחבר לשירות ה-AI כרגע.";
}

export function createAiAgentInitialState({
  session,
  initialText = "",
  initialWorkflow = AI_ASSIST_WORKFLOWS.general
} = {}) {
  return {
    msgs: [{ role: "assistant", content: aiAssistWelcomeMessage(session) }],
    input: initialText || "",
    inputWorkflow: initialWorkflow || AI_ASSIST_WORKFLOWS.general,
    busy: false,
    actionBusy: "",
    actionResults: {}
  };
}

export function buildAiAgentSystemPrompt(context) {
  if (typeof context === "string") {
    return `אתה עוזר אחזקה במרכז לוגיסטי בישראל. ענה בעברית בקצרה על בסיס הנתונים בלבד.\n\n--- נתונים ---\n${context}`;
  }
  return "אתה עוזר אחזקה במרכז לוגיסטי בישראל. ענה בעברית בקצרה על בסיס הקונטקסט המסונן בלבד.";
}

export function aiAgentRecentMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message, index) => !(index === 0 && message?.role === "assistant"))
    .map((message) => ({ role: message.role, content: message.content }));
}

export function buildAiAgentRequest({
  text,
  messages = [],
  conversationId = "",
  context,
  workflow = AI_ASSIST_WORKFLOWS.general
} = {}) {
  const request = {
    text,
    messages: aiAgentRecentMessages(messages),
    system: buildAiAgentSystemPrompt(context),
    context,
    workflow,
    includeProviderPlan: shouldRequestProviderPlan(workflow)
  };
  if (conversationId) request.conversationId = conversationId;
  return request;
}

export function beginAiAgentSend(state, {
  text,
  workflow = AI_ASSIST_WORKFLOWS.general,
  context,
  conversationId = ""
} = {}) {
  const q = cleanText(text ?? state?.input, "");
  if (!q || state?.busy) return { state, request: null };
  const history = [...(state?.msgs || []), { role: "user", content: q }];
  return {
    state: {
      ...state,
      msgs: history,
      input: "",
      inputWorkflow: AI_ASSIST_WORKFLOWS.general,
      busy: true
    },
    request: buildAiAgentRequest({ text: q, messages: history, conversationId, context, workflow })
  };
}

export function aiConversationMessagesToPanelMessages(messages = [], { session } = {}) {
  const stored = (Array.isArray(messages) ? messages : [])
    .filter((message) => ["user", "assistant"].includes(message?.role) && cleanText(message.content))
    .map((message) => ({
      role: message.role,
      content: cleanText(message.content),
      memoryCitations: Array.isArray(message.memoryCitations) ? message.memoryCitations : [],
      memoryGrounding: message.memoryGrounding || null
    }));
  return [{ role: "assistant", content: aiAssistWelcomeMessage(session) }, ...stored];
}

export function completeAiAgentSend(state, output) {
  const normalized = normalizeAiPanelAssistantOutput(output);
  return {
    ...state,
    busy: false,
    msgs: [...(state?.msgs || []), {
      role: "assistant",
      content: normalized.text,
      actions: normalized.actions,
      memoryCitations: normalized.memoryCitations,
      memoryGrounding: normalized.memoryGrounding,
      providerPlan: normalized.providerPlan,
      providerPlanErrorCode: normalized.providerPlanErrorCode
    }]
  };
}

export function failAiAgentSend(state, error) {
  return {
    ...state,
    busy: false,
    msgs: [...(state?.msgs || []), { role: "assistant", content: aiAssistantFailureMessage(error) }]
  };
}

export function aiAgentActionKey(action = {}) {
  return action?.id || action?.type || "";
}

export function beginAiAgentAction(state, action) {
  const key = aiAgentActionKey(action);
  if (!key || state?.actionBusy) return { state, key: "" };
  return {
    key,
    state: {
      ...state,
      actionBusy: key,
      actionResults: { ...(state?.actionResults || {}), [key]: null }
    }
  };
}

export function completeAiAgentAction(state, key, result = {}) {
  return {
    ...state,
    actionBusy: "",
    actionResults: {
      ...(state?.actionResults || {}),
      [key]: { ok: true, message: result?.message || "הקריאה נוצרה ונשמרה במערכת." }
    }
  };
}

export function failAiAgentAction(state, key, error = {}) {
  return {
    ...state,
    actionBusy: "",
    actionResults: {
      ...(state?.actionResults || {}),
      [key]: { ok: false, message: error?.message || "הפעולה לא הושלמה. בדקו פרטים ונסו שוב." }
    }
  };
}
