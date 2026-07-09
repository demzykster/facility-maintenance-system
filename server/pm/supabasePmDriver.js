import { pmRecordFromSupabaseRow, pmRecordToSupabaseRow } from "../../src/pmRecordModel.js";

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

export function createSupabasePmDriver({ url, serviceRoleKey, table = "periodic_maintenance", fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const base = `${root}/rest/v1/${encodeURIComponent(table)}`;

  return {
    async list({ limit = 1000 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 2000);
      const response = await fetchImpl(`${base}?select=*&order=next_due.asc&limit=${safeLimit}`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_pm_${response.status}`));
      return Array.isArray(data) ? data.map(pmRecordFromSupabaseRow) : [];
    },
    async get(id) {
      const taskId = String(id || "").trim();
      if (!taskId) throw new Error("pm_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(taskId)}&select=*&limit=1`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_pm_${response.status}`));
      return Array.isArray(data) && data[0] ? pmRecordFromSupabaseRow(data[0]) : null;
    },
    async upsert(task) {
      const row = pmRecordToSupabaseRow(task);
      const response = await fetchImpl(`${base}?on_conflict=id`, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "resolution=merge-duplicates,return=representation" }),
        body: JSON.stringify(row)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_pm_${response.status}`));
      return Array.isArray(data) ? data[0] : data;
    },
    async delete(id) {
      const taskId = String(id || "").trim();
      if (!taskId) throw new Error("pm_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(taskId)}`, {
        method: "DELETE",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_pm_${response.status}`));
    }
  };
}

export function createSupabasePmDriverFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabasePmDriver({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    table: env.CMMS_PM_SUPABASE_TABLE || "periodic_maintenance",
    fetchImpl
  });
}
