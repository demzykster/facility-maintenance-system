import {
  aiConversationMessageToRow,
  aiConversationToRow,
  buildAiConversationRecentHistory,
  normalizeAiConversationMessageRow,
  normalizeAiConversationRow
} from "../../../src/aiConversationModel.js";

const readJsonOrText = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const serviceHeaders = (serviceRoleKey, extra = {}) => ({
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
  ...extra
});

const errorMessage = (data, fallback) => data?.message || data?.details || data?.hint || data?.code || data?.error || fallback;
const cleanText = (value, limit = 240) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
const definedOnly = (row = {}) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));

function conversationPatchToRow(patch = {}) {
  return definedOnly({
    title: patch.title,
    status: patch.status,
    updated_at: patch.updatedAt ? new Date(Number(patch.updatedAt)).toISOString() : undefined,
    last_message_at: patch.lastMessageAt ? new Date(Number(patch.lastMessageAt)).toISOString() : undefined,
    metadata: patch.metadata
  });
}

export function createSupabaseAiConversationStore({
  url,
  serviceRoleKey,
  conversationsTable = "ai_conversations",
  messagesTable = "ai_conversation_messages",
  fetchImpl = globalThis.fetch
} = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const conversationsBase = `${root}/rest/v1/${encodeURIComponent(conversationsTable)}`;
  const messagesBase = `${root}/rest/v1/${encodeURIComponent(messagesTable)}`;

  async function getMessageByIdempotency({ conversationId, role, idempotencyKey }) {
    if (!idempotencyKey) return null;
    const query = [
      "select=*",
      `conversation_id=eq.${encodeURIComponent(conversationId)}`,
      `role=eq.${encodeURIComponent(role)}`,
      `idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`,
      "limit=1"
    ].join("&");
    const response = await fetchImpl(`${messagesBase}?${query}`, { method: "GET", headers: serviceHeaders(serviceRoleKey) });
    const data = await readJsonOrText(response);
    if (!response.ok) throw new Error(errorMessage(data, `supabase_ai_conversation_message_get_${response.status}`));
    return Array.isArray(data) && data[0] ? normalizeAiConversationMessageRow(data[0]) : null;
  }

  async function touchConversation({ id, at }) {
    if (!id) return;
    const response = await fetchImpl(`${conversationsBase}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" }),
      body: JSON.stringify(conversationPatchToRow({ updatedAt: at, lastMessageAt: at }))
    });
    const data = await readJsonOrText(response);
    if (!response.ok) throw new Error(errorMessage(data, `supabase_ai_conversation_touch_${response.status}`));
  }

  return {
    async listMine({ ownerUserId, limit = 12 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
      const query = [
        "select=*",
        `owner_user_id=eq.${encodeURIComponent(cleanText(ownerUserId, 120))}`,
        "status=eq.active",
        "order=last_message_at.desc",
        `limit=${safeLimit}`
      ].join("&");
      const response = await fetchImpl(`${conversationsBase}?${query}`, { method: "GET", headers: serviceHeaders(serviceRoleKey) });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ai_conversation_list_${response.status}`));
      return Array.isArray(data) ? data.map(normalizeAiConversationRow) : [];
    },
    async getMine({ id, ownerUserId } = {}) {
      const query = [
        "select=*",
        `id=eq.${encodeURIComponent(cleanText(id, 120))}`,
        `owner_user_id=eq.${encodeURIComponent(cleanText(ownerUserId, 120))}`,
        "status=eq.active",
        "limit=1"
      ].join("&");
      const response = await fetchImpl(`${conversationsBase}?${query}`, { method: "GET", headers: serviceHeaders(serviceRoleKey) });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ai_conversation_get_${response.status}`));
      return Array.isArray(data) && data[0] ? normalizeAiConversationRow(data[0]) : null;
    },
    async create(conversation) {
      const response = await fetchImpl(conversationsBase, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=representation" }),
        body: JSON.stringify(aiConversationToRow(conversation))
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ai_conversation_create_${response.status}`));
      return normalizeAiConversationRow(Array.isArray(data) ? data[0] : data);
    },
    async archiveMine({ id, ownerUserId, at } = {}) {
      const query = [
        `id=eq.${encodeURIComponent(cleanText(id, 120))}`,
        `owner_user_id=eq.${encodeURIComponent(cleanText(ownerUserId, 120))}`,
        "status=eq.active"
      ].join("&");
      const response = await fetchImpl(`${conversationsBase}?${query}`, {
        method: "PATCH",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=representation" }),
        body: JSON.stringify(conversationPatchToRow({ status: "archived", updatedAt: at }))
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ai_conversation_archive_${response.status}`));
      return Array.isArray(data) && data[0] ? normalizeAiConversationRow(data[0]) : null;
    },
    async listMessages({ conversationId, limit = 200 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
      const query = [
        "select=*",
        `conversation_id=eq.${encodeURIComponent(cleanText(conversationId, 120))}`,
        "order=sequence.asc",
        `limit=${safeLimit}`
      ].join("&");
      const response = await fetchImpl(`${messagesBase}?${query}`, { method: "GET", headers: serviceHeaders(serviceRoleKey) });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ai_conversation_messages_${response.status}`));
      return Array.isArray(data) ? data.map(normalizeAiConversationMessageRow) : [];
    },
    async appendMessage(message) {
      const existing = await getMessageByIdempotency({
        conversationId: message.conversationId,
        role: message.role,
        idempotencyKey: message.idempotencyKey
      });
      if (existing) return { message: existing, action: "replayed" };
      const response = await fetchImpl(messagesBase, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=representation" }),
        body: JSON.stringify(aiConversationMessageToRow(message))
      });
      const data = await readJsonOrText(response);
      if (!response.ok) {
        const fallback = await getMessageByIdempotency({
          conversationId: message.conversationId,
          role: message.role,
          idempotencyKey: message.idempotencyKey
        });
        if (fallback) return { message: fallback, action: "replayed" };
        throw new Error(errorMessage(data, `supabase_ai_conversation_message_create_${response.status}`));
      }
      const saved = normalizeAiConversationMessageRow(Array.isArray(data) ? data[0] : data);
      await touchConversation({ id: saved.conversationId, at: saved.createdAt || Date.now() });
      return { message: saved, action: "created" };
    },
    async buildRecentHistory({ conversationId, limit = 8 } = {}) {
      return buildAiConversationRecentHistory(await this.listMessages({ conversationId, limit: 200 }), { limit });
    }
  };
}

export function createSupabaseAiConversationStoreFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabaseAiConversationStore({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    conversationsTable: env.CMMS_AI_CONVERSATIONS_SUPABASE_TABLE || "ai_conversations",
    messagesTable: env.CMMS_AI_CONVERSATION_MESSAGES_SUPABASE_TABLE || "ai_conversation_messages",
    fetchImpl
  });
}
