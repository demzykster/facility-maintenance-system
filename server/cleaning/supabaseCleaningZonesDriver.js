import { cleaningZoneRecordFromSupabaseRow, cleaningZoneRecordToSupabaseRow } from "../../src/cleaningZoneRecordModel.js";

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

export function createSupabaseCleaningZonesDriver({ url, serviceRoleKey, table = "cleaning_zones", fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const base = `${root}/rest/v1/${encodeURIComponent(table)}`;

  return {
    async list({ limit = 1000 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 2000);
      const response = await fetchImpl(`${base}?select=*&order=name.asc&limit=${safeLimit}`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_cleaning_zones_${response.status}`));
      return Array.isArray(data) ? data.map(cleaningZoneRecordFromSupabaseRow) : [];
    },
    async get(id) {
      const zoneId = String(id || "").trim();
      if (!zoneId) throw new Error("cleaning_zone_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(zoneId)}&select=*&limit=1`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_cleaning_zones_${response.status}`));
      return Array.isArray(data) && data[0] ? cleaningZoneRecordFromSupabaseRow(data[0]) : null;
    },
    async upsert(zone) {
      const row = cleaningZoneRecordToSupabaseRow(zone);
      const response = await fetchImpl(`${base}?on_conflict=id`, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "resolution=merge-duplicates,return=representation" }),
        body: JSON.stringify(row)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_cleaning_zones_${response.status}`));
      return Array.isArray(data) ? data[0] : data;
    },
    async delete(id) {
      const zoneId = String(id || "").trim();
      if (!zoneId) throw new Error("cleaning_zone_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(zoneId)}`, {
        method: "DELETE",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_cleaning_zones_${response.status}`));
    }
  };
}

export function createSupabaseCleaningZonesDriverFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabaseCleaningZonesDriver({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    table: env.CMMS_CLEANING_ZONES_SUPABASE_TABLE || "cleaning_zones",
    fetchImpl
  });
}
