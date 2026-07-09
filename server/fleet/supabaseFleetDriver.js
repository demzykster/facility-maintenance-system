import { fleetRecordFromSupabaseRow, fleetRecordToSupabaseRow } from "../../src/fleetRecordModel.js";

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

export function createSupabaseFleetDriver({ url, serviceRoleKey, table = "fleet_units", fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const base = `${root}/rest/v1/${encodeURIComponent(table)}`;

  return {
    async list({ limit = 1000 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 2000);
      const response = await fetchImpl(`${base}?select=*&order=code.asc&limit=${safeLimit}`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_fleet_${response.status}`));
      return Array.isArray(data) ? data.map(fleetRecordFromSupabaseRow) : [];
    },
    async get(id) {
      const unitId = String(id || "").trim();
      if (!unitId) throw new Error("fleet_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(unitId)}&select=*&limit=1`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_fleet_${response.status}`));
      return Array.isArray(data) && data[0] ? fleetRecordFromSupabaseRow(data[0]) : null;
    },
    async upsert(unit) {
      const row = fleetRecordToSupabaseRow(unit);
      const response = await fetchImpl(`${base}?on_conflict=id`, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "resolution=merge-duplicates,return=representation" }),
        body: JSON.stringify(row)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_fleet_${response.status}`));
      return Array.isArray(data) ? data[0] : data;
    },
    async delete(id) {
      const unitId = String(id || "").trim();
      if (!unitId) throw new Error("fleet_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(unitId)}`, {
        method: "DELETE",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_fleet_${response.status}`));
    }
  };
}

export function createSupabaseFleetDriverFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabaseFleetDriver({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    table: env.CMMS_FLEET_SUPABASE_TABLE || "fleet_units",
    fetchImpl
  });
}
