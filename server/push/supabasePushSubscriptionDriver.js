import { parsePushSubscriptions } from "../../src/pushNotificationModel.js";
import { pushSubscriptionRecordFromSupabaseRow, pushSubscriptionRecordToSupabaseRow } from "../../src/pushSubscriptionRecordModel.js";

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

export function createSupabasePushSubscriptionDriver({ url, serviceRoleKey, table = "push_subscriptions", fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !table || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const base = `${root}/rest/v1/${encodeURIComponent(table)}`;

  return {
    async list({ limit = 1000 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 2000);
      const response = await fetchImpl(`${base}?select=*&order=updated_at.desc&limit=${safeLimit}`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_${table}_${response.status}`));
      return parsePushSubscriptions(Array.isArray(data) ? data.map(pushSubscriptionRecordFromSupabaseRow) : []);
    },
    async upsert(record) {
      const row = pushSubscriptionRecordToSupabaseRow(record);
      const response = await fetchImpl(`${base}?on_conflict=id`, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "resolution=merge-duplicates,return=representation" }),
        body: JSON.stringify(row)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_${table}_${response.status}`));
      return Array.isArray(data) ? data[0] : data;
    },
    async delete(id) {
      const recordId = String(id || "").trim();
      if (!recordId) throw new Error("push_subscription_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(recordId)}`, {
        method: "DELETE",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_${table}_${response.status}`));
    }
  };
}

export function createSupabasePushSubscriptionDriverFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabasePushSubscriptionDriver({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    table: env.CMMS_PUSH_SUBSCRIPTIONS_SUPABASE_TABLE || "push_subscriptions",
    fetchImpl
  });
}
