export function createAiAssistIdempotencyKey({
  cryptoRef = typeof crypto !== "undefined" ? crypto : null,
  now = Date.now,
  random = Math.random
} = {}) {
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") return cryptoRef.randomUUID();
  return `ai-${now()}-${random().toString(36).slice(2)}`;
}

export function buildAiAssistApiPayload({
  text,
  messages,
  conversationId,
  context,
  workflow,
  includeProviderPlan = false,
  idempotencyKey
} = {}) {
  return {
    text,
    messages,
    conversationId,
    language: "he",
    source: "ui",
    workflow,
    includeProviderPlan,
    idempotencyKey,
    context
  };
}

export async function callAiAssistApi({
  text,
  messages,
  conversationId,
  context,
  workflow,
  includeProviderPlan = false,
  idempotencyKey = createAiAssistIdempotencyKey(),
  getAccessToken = async () => "",
  fetchImpl = typeof fetch !== "undefined" ? fetch : null
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  const accessToken = await getAccessToken();
  const headers = { "content-type": "application/json" };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  const res = await fetchImpl("/api/ai/assist", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(buildAiAssistApiPayload({
      text,
      messages,
      conversationId,
      context,
      workflow,
      includeProviderPlan,
      idempotencyKey
    }))
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (Array.isArray(data?.actions) && data.actions.length) {
      return {
        text: data?.draft?.userReply || "",
        actions: data.actions,
        memoryCitations: [],
        memoryGrounding: null,
        providerPlan: null,
        providerPlanErrorCode: data.providerErrorCode || data.error || `ai-assist-${res.status}`
      };
    }
    throw new Error(data.providerErrorCode || data.error || `ai-assist-${res.status}`);
  }
  const normalized = {
    text: data?.assistant?.text || data?.draft?.userReply || "",
    actions: Array.isArray(data?.actions) ? data.actions : [],
    memoryCitations: Array.isArray(data?.assistant?.memoryCitations)
      ? data.assistant.memoryCitations
      : Array.isArray(data?.memoryCitations) ? data.memoryCitations : [],
    memoryGrounding: data?.assistant?.memoryGrounding && typeof data.assistant.memoryGrounding === "object"
      ? data.assistant.memoryGrounding
      : data?.memoryGrounding && typeof data.memoryGrounding === "object" ? data.memoryGrounding : null,
    providerPlan: data?.providerPlan || null,
    providerPlanErrorCode: data?.providerPlanErrorCode || ""
  };
  if (data?.conversation && typeof data.conversation === "object") normalized.conversation = data.conversation;
  return normalized;
}

function aiHeaders(accessToken = "") {
  const headers = { "content-type": "application/json" };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function memoryHeaders(accessToken = "") {
  return aiHeaders(accessToken);
}

export async function getAiServerStatus({
  check = false,
  getAccessToken = async () => "",
  fetchImpl = typeof fetch !== "undefined" ? fetch : null
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  const accessToken = await getAccessToken();
  const res = await fetchImpl(`/api/ai/status${check ? "?check=1" : ""}`, {
    method: "GET",
    credentials: "include",
    headers: aiHeaders(accessToken)
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || `ai-status-${res.status}`);
  return data.ai || null;
}

export async function getAiConversationAccess({
  getAccessToken = async () => "",
  fetchImpl = typeof fetch !== "undefined" ? fetch : null
} = {}) {
  const ai = await getAiServerStatus({ getAccessToken, fetchImpl });
  return ai?.conversations && typeof ai.conversations === "object"
    ? ai.conversations
    : { globalEnabled: false, pilotMember: false, effectiveAccess: false };
}

export async function listAiConversations({
  getAccessToken = async () => "",
  fetchImpl = typeof fetch !== "undefined" ? fetch : null
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  const accessToken = await getAccessToken();
  const res = await fetchImpl("/api/ai/conversations", {
    method: "GET",
    credentials: "include",
    headers: aiHeaders(accessToken)
  });
  const data = await readJson(res);
  if (res.status === 404 && data?.error === "ai_conversations_pilot_disabled") return [];
  if (res.status === 403 && data?.error === "ai_conversations_pilot_permission_required") return [];
  if (res.status === 401 && data?.error === "access_token_required") return [];
  if (!res.ok) throw new Error(data.error || `ai-conversations-${res.status}`);
  return Array.isArray(data?.conversations) ? data.conversations : [];
}

export async function createAiConversation({
  title = "",
  getAccessToken = async () => "",
  fetchImpl = typeof fetch !== "undefined" ? fetch : null
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  const accessToken = await getAccessToken();
  const res = await fetchImpl("/api/ai/conversations", {
    method: "POST",
    credentials: "include",
    headers: aiHeaders(accessToken),
    body: JSON.stringify({ title })
  });
  const data = await readJson(res);
  if (res.status === 404 && data?.error === "ai_conversations_pilot_disabled") return null;
  if (res.status === 403 && data?.error === "ai_conversations_pilot_permission_required") return null;
  if (!res.ok) throw new Error(data.error || `ai-conversations-${res.status}`);
  return data.conversation || null;
}

export async function getAiConversation({
  id,
  getAccessToken = async () => "",
  fetchImpl = typeof fetch !== "undefined" ? fetch : null
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  const accessToken = await getAccessToken();
  const res = await fetchImpl(`/api/ai/conversations?id=${encodeURIComponent(id || "")}`, {
    method: "GET",
    credentials: "include",
    headers: aiHeaders(accessToken)
  });
  const data = await readJson(res);
  if (res.status === 404 && data?.error === "ai_conversations_pilot_disabled") return null;
  if (res.status === 403 && data?.error === "ai_conversations_pilot_permission_required") return null;
  if (!res.ok) throw new Error(data.error || `ai-conversations-${res.status}`);
  return {
    conversation: data.conversation || null,
    messages: Array.isArray(data.messages) ? data.messages : []
  };
}

export async function archiveAiConversation({
  id,
  getAccessToken = async () => "",
  fetchImpl = typeof fetch !== "undefined" ? fetch : null
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  const accessToken = await getAccessToken();
  const res = await fetchImpl("/api/ai/conversations", {
    method: "DELETE",
    credentials: "include",
    headers: aiHeaders(accessToken),
    body: JSON.stringify({ id })
  });
  const data = await readJson(res);
  if (res.status === 404 && data?.error === "ai_conversations_pilot_disabled") return null;
  if (res.status === 403 && data?.error === "ai_conversations_pilot_permission_required") return null;
  if (!res.ok) throw new Error(data.error || `ai-conversations-${res.status}`);
  return data.conversation || null;
}

export async function listAiMemoryFacts({
  getAccessToken = async () => "",
  fetchImpl = typeof fetch !== "undefined" ? fetch : null
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  const accessToken = await getAccessToken();
  const res = await fetchImpl("/api/ai/memory", {
    method: "GET",
    credentials: "include",
    headers: memoryHeaders(accessToken)
  });
  const data = await readJson(res);
  if (res.status === 404 && data?.error === "ai_memory_pilot_disabled") return [];
  if (res.status === 401 && data?.error === "access_token_required") return [];
  if (!res.ok) throw new Error(data.error || `ai-memory-${res.status}`);
  return Array.isArray(data?.facts) ? data.facts : [];
}

export async function createAiMemoryFact({
  fact,
  getAccessToken = async () => "",
  fetchImpl = typeof fetch !== "undefined" ? fetch : null
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  const accessToken = await getAccessToken();
  const res = await fetchImpl("/api/ai/memory", {
    method: "POST",
    credentials: "include",
    headers: memoryHeaders(accessToken),
    body: JSON.stringify({ fact })
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || `ai-memory-${res.status}`);
  return data.fact || null;
}

export async function updateAiMemoryFact({
  id,
  fact,
  getAccessToken = async () => "",
  fetchImpl = typeof fetch !== "undefined" ? fetch : null
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  const accessToken = await getAccessToken();
  const res = await fetchImpl("/api/ai/memory", {
    method: "PATCH",
    credentials: "include",
    headers: memoryHeaders(accessToken),
    body: JSON.stringify({ id, fact })
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || `ai-memory-${res.status}`);
  return data.fact || null;
}

export async function deactivateAiMemoryFact({
  id,
  reason = "user_requested",
  getAccessToken = async () => "",
  fetchImpl = typeof fetch !== "undefined" ? fetch : null
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  const accessToken = await getAccessToken();
  const res = await fetchImpl("/api/ai/memory", {
    method: "DELETE",
    credentials: "include",
    headers: memoryHeaders(accessToken),
    body: JSON.stringify({ id, reason })
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || `ai-memory-${res.status}`);
  return data.fact || null;
}
