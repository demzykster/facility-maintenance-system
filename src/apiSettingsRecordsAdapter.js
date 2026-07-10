const parseJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const assertOk = async (response) => {
  if (response.ok) return response;
  const body = await parseJson(response).catch(() => null);
  throw new Error(body?.error || `settings_records_api_${response.status}`);
};

function createApiSettingsResourceProvider({ baseUrl, resource, singular, fetchImpl = globalThis.fetch, getAccessToken = null } = {}) {
  if (!baseUrl) return null;
  const root = String(baseUrl).replace(/\/+$/, "");
  if (typeof fetchImpl !== "function") throw new Error("settings_records_api_fetch_missing");
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
      const response = await request(`/settings/records?${resourceQuery}`, { method: "GET" });
      return parseJson(response);
    },
    async get(id) {
      const response = await request(`/settings/records?${resourceQuery}&id=${encodeURIComponent(id)}`, { method: "GET" });
      return parseJson(response);
    },
    async upsert(record) {
      const response = await request("/settings/records", {
        method: "POST",
        body: JSON.stringify({ resource, [singular]: record })
      });
      return parseJson(response);
    },
    async delete(id) {
      await request(`/settings/records?${resourceQuery}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      return true;
    }
  };
}

export function createApiSettingsRecordsProvider(options = {}) {
  if (!options.baseUrl) return null;
  return {
    locations: createApiSettingsResourceProvider({ ...options, resource: "locations", singular: "location" }),
    appIssues: createApiSettingsResourceProvider({ ...options, resource: "appIssues", singular: "appIssue" })
  };
}
