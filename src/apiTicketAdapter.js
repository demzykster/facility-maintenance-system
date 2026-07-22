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

  const postTicket = async (ticket, operation = "", { idempotencyKey = "" } = {}) => {
    const cleanOperation = String(operation || "").trim();
    const cleanIdempotencyKey = String(idempotencyKey || "").trim();
    const body = {
      ticket,
      ...(cleanOperation ? { operation: cleanOperation } : {}),
      ...(cleanIdempotencyKey ? { idempotencyKey: cleanIdempotencyKey } : {})
    };
    const response = await request("/tickets", {
      method: "POST",
      headers: cleanIdempotencyKey ? { "idempotency-key": cleanIdempotencyKey } : undefined,
      body: JSON.stringify(body)
    });
    return parseJson(response);
  };

  return {
    async list() {
      const response = await request("/tickets", { method: "GET" });
      return parseJson(response);
    },
    async get(id, { includeFiles = false } = {}) {
      const suffix = includeFiles ? "&includeFiles=1" : "";
      const response = await request(`/tickets?id=${encodeURIComponent(id)}${suffix}`, { method: "GET" });
      return parseJson(response);
    },
    async upsert(ticket) {
      return postTicket(ticket);
    },
    async create(ticket, options = {}) {
      return postTicket(ticket, "create", options);
    },
    async update(ticket) {
      return postTicket(ticket, "update");
    },
    async updatePriority(id, priority) {
      return postTicket({ id, priority }, "priority");
    },
    async updateDowntime(id, downtimeType) {
      return postTicket({ id, downtimeType }, "downtime");
    },
    async delete(id) {
      await request(`/tickets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      return true;
    }
  };
}
