const scopeOf = (shared = false) => shared ? "shared" : "local";

const readJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const serviceHeaders = (serviceRoleKey, extra = {}) => ({
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
  ...extra
});

const errorMessage = (data, fallback) => data?.message || data?.details || data?.hint || data?.code || data?.error || fallback;

export function createSupabaseKvDriver({ url, serviceRoleKey, table = "cmms_kv_records", fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const base = `${root}/rest/v1/${encodeURIComponent(table)}`;

  async function request(path, options = {}) {
    const response = await fetchImpl(`${base}${path}`, options);
    const data = await readJson(response);
    if (!response.ok) throw new Error(errorMessage(data, `supabase_kv_${response.status}`));
    return data;
  }

  return {
    async get(key, shared = false) {
      const rows = await request(`?scope=eq.${scopeOf(shared)}&record_key=eq.${encodeURIComponent(key)}&select=value&limit=1`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      return Array.isArray(rows) && rows[0] ? rows[0].value : null;
    },
    async set(key, value, shared = false) {
      await request("?on_conflict=scope,record_key", {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify({
          scope: scopeOf(shared),
          record_key: key,
          value: String(value ?? "")
        })
      });
    },
    async setMany(records = [], shared = false) {
      const rows = (Array.isArray(records) ? records : [])
        .filter((record) => record?.key)
        .map((record) => ({
          scope: scopeOf(shared),
          record_key: String(record.key),
          value: String(record.value ?? "")
        }));
      if (!rows.length) return;
      await request("?on_conflict=scope,record_key", {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(rows)
      });
    },
    async delete(key, shared = false) {
      await request(`?scope=eq.${scopeOf(shared)}&record_key=eq.${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: serviceHeaders(serviceRoleKey)
      });
    },
    async list(prefix = "", shared = false) {
      const rows = await request(`?scope=eq.${scopeOf(shared)}&record_key=like.${encodeURIComponent(`${prefix}%`)}&select=record_key`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      return Array.isArray(rows) ? rows.map((row) => row.record_key).filter(Boolean) : [];
    },
    async listValues(prefix = "", shared = false) {
      const rows = await request(`?scope=eq.${scopeOf(shared)}&record_key=like.${encodeURIComponent(`${prefix}%`)}&select=record_key,value`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      return Array.isArray(rows)
        ? rows.map((row) => ({ key: row.record_key, value: row.value })).filter((row) => row.key)
        : [];
    }
  };
}

export function createSupabaseKvDriverFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabaseKvDriver({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    table: env.CMMS_KV_SUPABASE_TABLE || "cmms_kv_records",
    fetchImpl
  });
}
