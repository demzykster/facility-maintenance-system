const parseJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const assertOk = async (response) => {
  if (response.ok) return response;
  const body = await parseJson(response).catch(() => null);
  throw new Error(body?.error || `cleaning_zones_api_${response.status}`);
};

export function createApiCleaningZonesProvider({ baseUrl, fetchImpl = globalThis.fetch, getAccessToken = null } = {}) {
  if (!baseUrl) return null;
  const root = String(baseUrl).replace(/\/+$/, "");
  if (typeof fetchImpl !== "function") throw new Error("cleaning_zones_api_fetch_missing");
  const resourceQuery = "resource=zones";

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
      const response = await request(`/cleaning/records?${resourceQuery}`, { method: "GET" });
      return parseJson(response);
    },
    async get(id) {
      const response = await request(`/cleaning/records?${resourceQuery}&id=${encodeURIComponent(id)}`, { method: "GET" });
      return parseJson(response);
    },
    async upsert(zone) {
      const response = await request("/cleaning/records", {
        method: "POST",
        body: JSON.stringify({ resource: "zones", zone })
      });
      return parseJson(response);
    },
    async delete(id) {
      await request(`/cleaning/records?${resourceQuery}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      return true;
    }
  };
}
