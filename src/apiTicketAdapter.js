const parseJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const assertOk = async (response) => {
  if (response.ok) return response;
  const body = await parseJson(response).catch(() => null);
  throw new Error(body?.error || `tickets_api_${response.status}`);
};

export function createApiTicketProvider({ baseUrl, fetchImpl = globalThis.fetch, getAccessToken = null } = {}) {
  if (!baseUrl) return null;
  const root = String(baseUrl).replace(/\/+$/, "");
  if (typeof fetchImpl !== "function") throw new Error("tickets_api_fetch_missing");

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
    async upsert(ticket) {
      const response = await request("/tickets", {
        method: "POST",
        body: JSON.stringify({ ticket })
      });
      return parseJson(response);
    },
    async delete(id) {
      await request(`/tickets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      return true;
    }
  };
}
