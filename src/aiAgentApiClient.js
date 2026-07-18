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
  if (!res.ok) throw new Error(data.providerErrorCode || data.error || `ai-assist-${res.status}`);
  return {
    text: data?.assistant?.text || data?.draft?.userReply || "",
    actions: Array.isArray(data?.actions) ? data.actions : [],
    providerPlan: data?.providerPlan || null,
    providerPlanErrorCode: data?.providerPlanErrorCode || ""
  };
}
