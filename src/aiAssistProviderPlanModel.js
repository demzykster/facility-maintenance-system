const MAX_TEXT = 500;
const MAX_ITEMS = 5;

const ALLOWED_TYPES = new Set([
  "ticket.create",
  "ticket.update",
  "ticket.comment",
  "task.create",
  "task.update",
  "meeting.create",
  "meeting.update",
  "ppe.request.create",
  "question",
  "handoff"
]);

const cleanText = (value, limit = MAX_TEXT) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const clampConfidence = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
};

const cleanStringList = (value, limit = 5) => Array.isArray(value)
  ? value.map((item) => cleanText(item, 160)).filter(Boolean).slice(0, limit)
  : [];

function providerSafeConversationMessages(conversation = []) {
  return Array.isArray(conversation)
    ? conversation.slice(-6).map((message) => {
      if (message?.role === "user") return { role: "user", content: cleanText(message.content, 500) };
      if (message?.role === "assistant") return { role: "assistant", content: "[previous assistant reply omitted]" };
      return null;
    }).filter((message) => message && message.content)
    : [];
}

export const AI_PROVIDER_PLAN_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    items: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          reason: { type: "string" },
          confidence: { type: "number" },
          missingFields: {
            type: "array",
            items: { type: "string" }
          },
          reviewNotes: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["type", "title"]
      }
    }
  },
  required: ["summary", "items"]
});

export function sanitizeAiProviderPlan(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const items = Array.isArray(source.items) ? source.items : [];
  const sanitizedItems = items
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const type = cleanText(item.type, 80);
      if (!ALLOWED_TYPES.has(type)) return null;
      const title = cleanText(item.title, 180);
      if (!title) return null;
      return {
        id: `provider_plan_${index + 1}`,
        type,
        title,
        reason: cleanText(item.reason, 260),
        confidence: clampConfidence(item.confidence),
        missingFields: cleanStringList(item.missingFields),
        reviewNotes: cleanStringList(item.reviewNotes),
        requiresConfirmation: true,
        writesData: false,
        writePolicy: "human_confirmation_required"
      };
    })
    .filter(Boolean)
    .slice(0, MAX_ITEMS);

  return {
    summary: cleanText(source.summary, 500),
    items: sanitizedItems,
    requiresConfirmation: true,
    writesData: false,
    writePolicy: "human_confirmation_required",
    providerTextTrusted: false
  };
}

export function providerPlanPrompt({ draft = {}, actions = [], context = {}, workflow = "", conversation = [] } = {}) {
  return JSON.stringify({
    contract: {
      purpose: "Return a non-writing structured plan for a CMMS operator.",
      allowedToWrite: false,
      forbidden: [
        "Do not include executable API paths.",
        "Do not include database statements.",
        "Do not claim that anything was created, updated, deleted, assigned, closed, or approved.",
        "Do not invent records outside the role-filtered context."
      ],
      outputPolicy: "Only summarize reviewable next steps. The app will ignore any executable fields."
    },
    userRequest: cleanText(draft.rawText, 2_000),
    recentConversation: providerSafeConversationMessages(conversation),
    workflow,
    context,
    deterministicActions: actions.map((action) => ({
      id: action.id,
      type: action.type,
      status: action.status,
      missingFields: action.missingFields || []
    })),
    draft
  });
}
