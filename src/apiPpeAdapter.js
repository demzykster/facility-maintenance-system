const parseJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const assertOk = async (response) => {
  if (response.ok) return response;
  const body = await parseJson(response).catch(() => null);
  throw new Error(body?.error || `ppe_api_${response.status}`);
};

function createApiPpeResourceProvider({ baseUrl, resource, singular, fetchImpl = globalThis.fetch, getAccessToken = null } = {}) {
  if (!baseUrl) return null;
  const root = String(baseUrl).replace(/\/+$/, "");
  if (typeof fetchImpl !== "function") throw new Error("ppe_api_fetch_missing");
  const resourceQuery = `resource=${encodeURIComponent(resource)}`;

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
      const response = await request(`/ppe?${resourceQuery}`, { method: "GET" });
      return parseJson(response);
    },
    async get(id) {
      const response = await request(`/ppe?${resourceQuery}&id=${encodeURIComponent(id)}`, { method: "GET" });
      return parseJson(response);
    },
    async upsert(record) {
      const response = await request("/ppe", {
        method: "POST",
        body: JSON.stringify({ resource, [singular]: record })
      });
      return parseJson(response);
    },
    async delete(id) {
      await request(`/ppe?${resourceQuery}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      return true;
    }
  };
}

export function createApiPpeProvider(options = {}) {
  if (!options.baseUrl) return null;
  return {
    movements: createApiPpeResourceProvider({ ...options, resource: "movements", singular: "movement" }),
    items: createApiPpeResourceProvider({ ...options, resource: "items", singular: "item" }),
    norms: createApiPpeResourceProvider({ ...options, resource: "norms", singular: "norm" }),
    requests: createApiPpeResourceProvider({ ...options, resource: "requests", singular: "request" }),
    orders: createApiPpeResourceProvider({ ...options, resource: "orders", singular: "order" })
  };
}
