const parseJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const assertOk = async (response) => {
  if (response.ok) return response;
  const body = await parseJson(response).catch(() => null);
  throw new Error(body?.error || `presence_api_${response.status}`);
};

export function createApiPresenceProvider({ baseUrl, fetchImpl = globalThis.fetch, getAccessToken = null } = {}) {
  if (!baseUrl) return null;
  const root = String(baseUrl).replace(/\/+$/, "");
  if (typeof fetchImpl !== "function") throw new Error("presence_api_fetch_missing");

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
    async list() {
      const response = await request("/presence", { method: "GET" });
      return parseJson(response);
    },
    async get(id) {
      const response = await request(`/presence?id=${encodeURIComponent(id)}`, { method: "GET" });
      return parseJson(response);
    },
    async upsert(presence) {
      const response = await request("/presence", {
        method: "POST",
        body: JSON.stringify({ presence })
      });
      return parseJson(response);
    },
    async delete(id) {
      await request(`/presence?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      return true;
    }
  };
}
