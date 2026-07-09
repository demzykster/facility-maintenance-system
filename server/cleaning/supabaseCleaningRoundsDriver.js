import { cleaningRoundRecordFromSupabaseRow, cleaningRoundRecordToSupabaseRow } from "../../src/cleaningRoundRecordModel.js";

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

export function createSupabaseCleaningRoundsDriver({ url, serviceRoleKey, table = "cleaning_rounds", fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const base = `${root}/rest/v1/${encodeURIComponent(table)}`;

  return {
    async list({ limit = 1000 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 2000);
      const response = await fetchImpl(`${base}?select=*&order=round_at.desc&limit=${safeLimit}`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_cleaning_rounds_${response.status}`));
      return Array.isArray(data) ? data.map(cleaningRoundRecordFromSupabaseRow) : [];
    },
    async get(id) {
      const roundId = String(id || "").trim();
      if (!roundId) throw new Error("cleaning_round_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(roundId)}&select=*&limit=1`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_cleaning_rounds_${response.status}`));
      return Array.isArray(data) && data[0] ? cleaningRoundRecordFromSupabaseRow(data[0]) : null;
    },
    async upsert(round) {
      const row = cleaningRoundRecordToSupabaseRow(round);
      const response = await fetchImpl(`${base}?on_conflict=id`, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "resolution=merge-duplicates,return=representation" }),
        body: JSON.stringify(row)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_cleaning_rounds_${response.status}`));
      return Array.isArray(data) ? data[0] : data;
    },
    async delete(id) {
      const roundId = String(id || "").trim();
      if (!roundId) throw new Error("cleaning_round_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(roundId)}`, {
        method: "DELETE",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_cleaning_rounds_${response.status}`));
    }
  };
}

export function createSupabaseCleaningRoundsDriverFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabaseCleaningRoundsDriver({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    table: env.CMMS_CLEANING_ROUNDS_SUPABASE_TABLE || "cleaning_rounds",
    fetchImpl
  });
}
