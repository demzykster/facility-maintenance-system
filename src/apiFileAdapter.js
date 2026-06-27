const parseJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const assertOk = async (response) => {
  if (response.ok) return response;
  const body = await parseJson(response).catch(() => null);
  throw new Error(body?.error || `file_api_${response.status}`);
};

export function createApiFileProvider({ baseUrl, fetchImpl = globalThis.fetch, getAccessToken = null } = {}) {
  if (!baseUrl) return null;
  const root = String(baseUrl).replace(/\/+$/, "");
  if (typeof fetchImpl !== "function") throw new Error("file_api_fetch_missing");

  const request = async (path, options = {}) => {
    const accessToken = typeof getAccessToken === "function" ? getAccessToken() : "";
    const response = await fetchImpl(`${root}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...(options.headers || {})
      }
    });
    return assertOk(response);
  };

  const filePath = (path) => `/files?path=${encodeURIComponent(path)}`;

  return {
    async upload(path, { data, contentType = "application/octet-stream", metadata = null } = {}) {
      await request(filePath(path), {
        method: "POST",
        body: JSON.stringify({ data, contentType, ...(metadata ? { metadata } : {}) })
      });
      return true;
    },
    async download(path) {
      const response = await request(filePath(path));
      return parseJson(response);
    },
    async delete(path) {
      await request(filePath(path), { method: "DELETE" });
      return true;
    }
  };
}
