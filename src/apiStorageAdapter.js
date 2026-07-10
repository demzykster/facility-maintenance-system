const parseJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const assertOk = async (response) => {
  if (response.ok) return response;
  const body = await parseJson(response).catch(() => null);
  throw new Error(body?.error || `storage_api_${response.status}`);
};

const APP_CONFIG_KEY = "config:v1";

export function createApiStorageProvider({ baseUrl, fetchImpl = globalThis.fetch, getAccessToken = null } = {}) {
  if (!baseUrl) return null;
  const root = String(baseUrl).replace(/\/+$/, "");
  if (typeof fetchImpl !== "function") throw new Error("storage_api_fetch_missing");

  const request = async (path, options = {}) => {
    const accessToken = typeof getAccessToken === "function" ? await getAccessToken() : "";
    const response = await fetchImpl(`${root}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...(options.headers || {})
      }
    });
    return assertOk(response);
  };

  return {
    async get(key, shared = false) {
      if (shared && key === APP_CONFIG_KEY) {
        const response = await request("/settings/config", { method: "GET" });
        return parseJson(response);
      }
      const response = await request(`/kv/${encodeURIComponent(key)}?shared=${shared ? "1" : "0"}`);
      return parseJson(response);
    },
    async set(key, value, shared = false) {
      if (shared && key === APP_CONFIG_KEY) {
        await request("/settings/config", {
          method: "PUT",
          body: JSON.stringify({ value })
        });
        return true;
      }
      await request(`/kv/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ value, shared: !!shared })
      });
      return true;
    },
    async setMany(records = [], shared = false, options = {}) {
      const safeRecords = Array.isArray(records) ? records : [];
      const configRecords = shared ? safeRecords.filter((record) => record?.key === APP_CONFIG_KEY) : [];
      const kvRecords = configRecords.length ? safeRecords.filter((record) => record?.key !== APP_CONFIG_KEY) : safeRecords;
      for (const record of configRecords) {
        await request("/settings/config", {
          method: "PUT",
          body: JSON.stringify({ value: record.value })
        });
      }
      if (!kvRecords.length) return true;
      await request("/kv", {
        method: "POST",
        body: JSON.stringify({ records: kvRecords, shared: !!shared, atomic: !!options.atomic })
      });
      return true;
    },
    async delete(key, shared = false) {
      if (shared && key === APP_CONFIG_KEY) {
        await request("/settings/config", { method: "DELETE" });
        return true;
      }
      await request(`/kv/${encodeURIComponent(key)}?shared=${shared ? "1" : "0"}`, { method: "DELETE" });
      return true;
    },
    async list(prefix = "", shared = false) {
      const response = await request(`/kv?prefix=${encodeURIComponent(prefix)}&shared=${shared ? "1" : "0"}`);
      return parseJson(response);
    },
    async listValues(prefix = "", shared = false) {
      const response = await request(`/kv?prefix=${encodeURIComponent(prefix)}&shared=${shared ? "1" : "0"}&includeValues=1`);
      return parseJson(response);
    },
    async listManyValues(prefixes = [], shared = false) {
      const joined = (Array.isArray(prefixes) ? prefixes : []).filter(Boolean).join(",");
      const response = await request(`/kv?prefixes=${encodeURIComponent(joined)}&shared=${shared ? "1" : "0"}&includeValues=1`);
      return parseJson(response);
    }
  };
}
