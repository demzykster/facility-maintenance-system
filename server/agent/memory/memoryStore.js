import {
  AI_MEMORY_STATUSES,
  aiMemoryFactToRow,
  normalizeAiMemoryFactRow
} from "../../../src/aiMemoryModel.js";

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
const definedOnly = (row = {}) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));

function aiMemoryPatchToRow(patch = {}) {
  return definedOnly({
    scope_type: patch.scopeType,
    scope_id: patch.scopeId,
    fact_type: patch.factType,
    summary: patch.summary,
    details: patch.details,
    source_type: patch.sourceType,
    source_id: patch.sourceId,
    source_label: patch.sourceLabel,
    confidence: patch.confidence,
    status: patch.status,
    version: patch.version,
    supersedes_id: patch.supersedesId,
    updated_by: patch.updatedBy || null,
    updated_at: patch.updatedAt ? new Date(Number(patch.updatedAt)).toISOString() : undefined,
    deactivated_at: patch.deactivatedAt ? new Date(Number(patch.deactivatedAt)).toISOString() : null,
    metadata: patch.metadata
  });
}

export function createSupabaseAiMemoryStore({ url, serviceRoleKey, table = "ai_memory_facts", fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const base = `${root}/rest/v1/${encodeURIComponent(table)}`;

  return {
    async list({ limit = 500 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 1000);
      const query = [
        "select=*",
        `status=eq.${encodeURIComponent(AI_MEMORY_STATUSES.active)}`,
        "order=updated_at.desc",
        `limit=${safeLimit}`
      ].join("&");
      const response = await fetchImpl(`${base}?${query}`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ai_memory_list_${response.status}`));
      return Array.isArray(data) ? data.map(normalizeAiMemoryFactRow) : [];
    },
    async get(id) {
      const factId = String(id || "").trim();
      if (!factId) throw new Error("memory_fact_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(factId)}&select=*&limit=1`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ai_memory_get_${response.status}`));
      return Array.isArray(data) && data[0] ? normalizeAiMemoryFactRow(data[0]) : null;
    },
    async create(fact) {
      const response = await fetchImpl(base, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=representation" }),
        body: JSON.stringify(aiMemoryFactToRow(fact))
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ai_memory_create_${response.status}`));
      return normalizeAiMemoryFactRow(Array.isArray(data) ? data[0] : data);
    },
    async update(id, patch = {}) {
      const factId = String(id || "").trim();
      if (!factId) throw new Error("memory_fact_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(factId)}`, {
        method: "PATCH",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=representation" }),
        body: JSON.stringify(aiMemoryPatchToRow(patch))
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ai_memory_update_${response.status}`));
      return normalizeAiMemoryFactRow(Array.isArray(data) ? data[0] : data);
    }
  };
}

export function createSupabaseAiMemoryStoreFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabaseAiMemoryStore({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    table: env.CMMS_AI_MEMORY_SUPABASE_TABLE || "ai_memory_facts",
    fetchImpl
  });
}
