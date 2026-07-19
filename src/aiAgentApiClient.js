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
  context,
  workflow,
  includeProviderPlan = false,
  idempotencyKey
} = {}) {
  return {
    text,
    messages,
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
        providerPlan: null,
        providerPlanErrorCode: data.providerErrorCode || data.error || `ai-assist-${res.status}`
      };
    }
    throw new Error(data.providerErrorCode || data.error || `ai-assist-${res.status}`);
  }
  return {
    text: data?.assistant?.text || data?.draft?.userReply || "",
    actions: Array.isArray(data?.actions) ? data.actions : [],
    providerPlan: data?.providerPlan || null,
    providerPlanErrorCode: data?.providerPlanErrorCode || ""
  };
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function memoryHeaders(accessToken = "") {
  const headers = { "content-type": "application/json" };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
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
