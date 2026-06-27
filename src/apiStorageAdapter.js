const parseJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const assertOk = async (response) => {
  if (response.ok) return response;
  const body = await parseJson(response).catch(() => null);
  throw new Error(body?.error || `storage_api_${response.status}`);
};

export function createApiStorageProvider({ baseUrl, fetchImpl = globalThis.fetch } = {}) {
  if (!baseUrl) return null;
  const root = String(baseUrl).replace(/\/+$/, "");
  if (typeof fetchImpl !== "function") throw new Error("storage_api_fetch_missing");

  const request = async (path, options = {}) => {
    const response = await fetchImpl(`${root}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {})
      }
    });
    return assertOk(response);
  };

  return {
    async get(key, shared = false) {
      const response = await request(`/kv/${encodeURIComponent(key)}?shared=${shared ? "1" : "0"}`);
      return parseJson(response);
    },
    async set(key, value, shared = false) {
      await request(`/kv/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ value, shared: !!shared })
      });
      return true;
    },
    async delete(key, shared = false) {
      await request(`/kv/${encodeURIComponent(key)}?shared=${shared ? "1" : "0"}`, { method: "DELETE" });
      return true;
    },
    async list(prefix = "", shared = false) {
      const response = await request(`/kv?prefix=${encodeURIComponent(prefix)}&shared=${shared ? "1" : "0"}`);
      return parseJson(response);
    }
  };
}
