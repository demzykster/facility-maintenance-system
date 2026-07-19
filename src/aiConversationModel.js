export const AI_CONVERSATION_STATUSES = Object.freeze({
  active: "active",
  archived: "archived"
});

export const AI_CONVERSATION_MESSAGE_ROLES = Object.freeze({
  user: "user",
  assistant: "assistant",
  systemSafeEvent: "system-safe-event"
});

const STATUSES = new Set(Object.values(AI_CONVERSATION_STATUSES));
const ROLES = new Set(Object.values(AI_CONVERSATION_MESSAGE_ROLES));
const MAX_TITLE = 160;
const MAX_CONTENT = 8_000;

const cleanText = (value, limit = 240) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanContent = (value, limit = MAX_CONTENT) => String(value || "")
  .replace(/\r\n?/g, "\n")
  .replace(/[ \t\f\v]+/g, " ")
  .replace(/\n{4,}/g, "\n\n\n")
  .trim()
  .slice(0, limit);

const cleanObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

function cleanMetadata(value = {}) {
  const input = cleanObject(value);
  const output = {};
  for (const key of ["provider", "model", "source", "workflow", "memoryGroundingMode"]) {
    const cleaned = cleanText(input[key], 160);
    if (cleaned) output[key] = cleaned;
  }
  return output;
}

export function aiConversationsPilotEnabled(env = {}) {
  const raw = String(env.CMMS_AI_CONVERSATIONS_PILOT || "").trim().toLowerCase();
  return ["1", "true", "yes", "on", "enabled", "local"].includes(raw);
}

export function aiConversationId({ now = Date.now, random = Math.random } = {}) {
  return `conv-${now()}-${random().toString(36).slice(2, 10)}`;
}

export function aiConversationMessageId({ now = Date.now, random = Math.random } = {}) {
  return `msg-${now()}-${random().toString(36).slice(2, 10)}`;
}

export function conversationTitleFromText(text = "") {
  return cleanText(text, MAX_TITLE) || "AI conversation";
}

export function normalizeAiConversationInput(input = {}, actor = {}, { now = Date.now, makeId = aiConversationId } = {}) {
  const at = Number(now());
  const requestedStatus = cleanText(input.status || AI_CONVERSATION_STATUSES.active, 40);
  const ownerUserId = cleanText(actor.id || actor.authUserId || actor.workerNo, 120);
  if (!ownerUserId) throw new Error("conversation_owner_required");
  return {
    id: cleanText(input.id, 120) || makeId({ now: () => at }),
    ownerUserId,
    title: conversationTitleFromText(input.title || input.text || input.summary),
    status: STATUSES.has(requestedStatus) ? requestedStatus : AI_CONVERSATION_STATUSES.active,
    createdAt: at,
    updatedAt: at,
    lastMessageAt: at,
    metadata: cleanMetadata(input.metadata)
  };
}

export function normalizeAiConversationRow(row = {}) {
  const status = cleanText(row.status || AI_CONVERSATION_STATUSES.active, 40);
  return {
    id: cleanText(row.id, 120),
    ownerUserId: cleanText(row.ownerUserId || row.owner_user_id, 120),
    title: conversationTitleFromText(row.title || "AI conversation"),
    status: STATUSES.has(status) ? status : AI_CONVERSATION_STATUSES.active,
    createdAt: row.createdAt || row.created_at ? Date.parse(row.createdAt || row.created_at) || Number(row.createdAt || row.created_at) || 0 : 0,
    updatedAt: row.updatedAt || row.updated_at ? Date.parse(row.updatedAt || row.updated_at) || Number(row.updatedAt || row.updated_at) || 0 : 0,
    lastMessageAt: row.lastMessageAt || row.last_message_at ? Date.parse(row.lastMessageAt || row.last_message_at) || Number(row.lastMessageAt || row.last_message_at) || 0 : 0,
    metadata: cleanMetadata(row.metadata)
  };
}

export function aiConversationToRow(conversation = {}) {
  return {
    id: conversation.id,
    owner_user_id: conversation.ownerUserId,
    title: conversation.title || "AI conversation",
    status: conversation.status || AI_CONVERSATION_STATUSES.active,
    created_at: conversation.createdAt ? new Date(Number(conversation.createdAt)).toISOString() : undefined,
    updated_at: conversation.updatedAt ? new Date(Number(conversation.updatedAt)).toISOString() : undefined,
    last_message_at: conversation.lastMessageAt ? new Date(Number(conversation.lastMessageAt)).toISOString() : undefined,
    metadata: cleanMetadata(conversation.metadata)
  };
}

export function aiConversationForClient(conversation = {}) {
  const normalized = normalizeAiConversationRow(conversation);
  return {
    id: normalized.id,
    title: normalized.title,
    status: normalized.status,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    lastMessageAt: normalized.lastMessageAt
  };
}

export function normalizeAiConversationMessageInput(input = {}, {
  conversationId = "",
  role = AI_CONVERSATION_MESSAGE_ROLES.user,
  actor = {}
} = {}, { now = Date.now, makeId = aiConversationMessageId } = {}) {
  const at = Number(now());
  const safeConversationId = cleanText(conversationId || input.conversationId || input.conversation_id, 120);
  const safeRole = ROLES.has(role) ? role : AI_CONVERSATION_MESSAGE_ROLES.user;
  const content = cleanContent(input.content || input.text || input.message);
  if (!safeConversationId) throw new Error("conversation_id_required");
  if (!content) throw new Error("conversation_message_required");
  return {
    id: cleanText(input.serverId, 120) || makeId({ now: () => at }),
    conversationId: safeConversationId,
    role: safeRole,
    content,
    requestId: cleanText(input.requestId || input.request_id, 200),
    idempotencyKey: cleanText(input.idempotencyKey || input.idempotency_key, 200),
    sequence: Math.max(Number(input.sequence) || 0, 0),
    createdAt: at,
    metadata: cleanMetadata(input.metadata)
  };
}

export function normalizeAiConversationMessageRow(row = {}) {
  const role = cleanText(row.role || AI_CONVERSATION_MESSAGE_ROLES.user, 40);
  return {
    id: cleanText(row.id, 120),
    conversationId: cleanText(row.conversationId || row.conversation_id, 120),
    role: ROLES.has(role) ? role : AI_CONVERSATION_MESSAGE_ROLES.user,
    content: cleanContent(row.content || row.normalized_text),
    requestId: cleanText(row.requestId || row.request_id, 200),
    idempotencyKey: cleanText(row.idempotencyKey || row.idempotency_key, 200),
    sequence: Math.max(Number(row.sequence) || 0, 0),
    createdAt: row.createdAt || row.created_at ? Date.parse(row.createdAt || row.created_at) || Number(row.createdAt || row.created_at) || 0 : 0,
    metadata: cleanMetadata(row.metadata)
  };
}

export function aiConversationMessageToRow(message = {}) {
  return {
    id: message.id,
    conversation_id: message.conversationId,
    role: message.role,
    content: message.content,
    request_id: message.requestId || null,
    idempotency_key: message.idempotencyKey || null,
    sequence: message.sequence || undefined,
    created_at: message.createdAt ? new Date(Number(message.createdAt)).toISOString() : undefined,
    metadata: cleanMetadata(message.metadata)
  };
}

export function aiConversationMessageForClient(message = {}) {
  const normalized = normalizeAiConversationMessageRow(message);
  return {
    id: normalized.id,
    role: normalized.role,
    content: normalized.content,
    createdAt: normalized.createdAt,
    metadata: cleanMetadata(normalized.metadata)
  };
}

export function buildAiConversationRecentHistory(messages = [], { limit = 8 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);
  return (Array.isArray(messages) ? messages : [])
    .map(normalizeAiConversationMessageRow)
    .filter((message) => ["user", "assistant"].includes(message.role) && message.content)
    .sort((a, b) => (a.sequence - b.sequence) || (a.createdAt - b.createdAt))
    .slice(-safeLimit)
    .map((message) => ({ role: message.role, content: message.content }));
}
