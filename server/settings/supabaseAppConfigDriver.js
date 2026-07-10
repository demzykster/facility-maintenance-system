import { APP_CONFIG_ID, appConfigRecordFromSupabaseRow, appConfigRecordToSupabaseRow } from "../../src/appConfigRecordModel.js";

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

export function createSupabaseAppConfigDriver({ url, serviceRoleKey, table = "app_config", fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const base = `${root}/rest/v1/${encodeURIComponent(table)}`;

  return {
    async get(id = APP_CONFIG_ID) {
      const recordId = String(id || APP_CONFIG_ID).trim() || APP_CONFIG_ID;
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(recordId)}&select=*&limit=1`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_${table}_${response.status}`));
      return Array.isArray(data) && data[0] ? appConfigRecordFromSupabaseRow(data[0]) : null;
    },
    async upsert(value, id = APP_CONFIG_ID) {
      const row = appConfigRecordToSupabaseRow(value, { id });
      const response = await fetchImpl(`${base}?on_conflict=id`, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "resolution=merge-duplicates,return=representation" }),
        body: JSON.stringify(row)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_${table}_${response.status}`));
      const rowData = Array.isArray(data) ? data[0] : data;
      return rowData ? appConfigRecordFromSupabaseRow(rowData) : appConfigRecordFromSupabaseRow(row);
    },
    async delete(id = APP_CONFIG_ID) {
      const recordId = String(id || APP_CONFIG_ID).trim() || APP_CONFIG_ID;
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(recordId)}`, {
        method: "DELETE",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_${table}_${response.status}`));
    }
  };
}

export function createSupabaseAppConfigDriverFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabaseAppConfigDriver({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    table: env.CMMS_APP_CONFIG_SUPABASE_TABLE || "app_config",
    fetchImpl
  });
}
