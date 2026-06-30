const storageKey = (key, shared = false) => `${shared ? "shared" : "local"}:${key}`;

const readJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

function createClient({ url, token, fetchImpl = globalThis.fetch } = {}) {
  if (!url || !token) return null;
  if (typeof fetchImpl !== "function") throw new Error("upstash_fetch_missing");
  const root = String(url).replace(/\/+$/, "");

  return async function command(args) {
    const response = await fetchImpl(root, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(args)
    });
    const body = await readJson(response);
    if (!response.ok || body?.error) throw new Error(body?.error || `upstash_${response.status}`);
    return body?.result;
  };
}

export function createUpstashKvDriver({ url, token, fetchImpl } = {}) {
  const command = createClient({ url, token, fetchImpl });
  if (!command) return null;

  return {
    async get(key, shared = false) {
      return command(["GET", storageKey(key, shared)]);
    },
    async getMany(keys = [], shared = false) {
      const cleanKeys = (Array.isArray(keys) ? keys : []).map((key) => String(key || "")).filter(Boolean);
      if (!cleanKeys.length) return [];
      const values = await command(["MGET", ...cleanKeys.map((key) => storageKey(key, shared))]);
      return cleanKeys.map((key, index) => ({ key, value: Array.isArray(values) ? values[index] : null }));
    },
    async set(key, value, shared = false) {
      await command(["SET", storageKey(key, shared), value]);
    },
    async delete(key, shared = false) {
      await command(["DEL", storageKey(key, shared)]);
    },
    async list(prefix = "", shared = false) {
      const match = `${storageKey(prefix, shared)}*`;
      const keys = [];
      let cursor = "0";

      do {
        const result = await command(["SCAN", cursor, "MATCH", match, "COUNT", "100"]);
        cursor = String(result?.[0] ?? "0");
        keys.push(...(Array.isArray(result?.[1]) ? result[1] : []));
      } while (cursor !== "0");

      const scope = storageKey("", shared);
      return keys.map((key) => String(key).startsWith(scope) ? String(key).slice(scope.length) : String(key));
    },
    async listValues(prefix = "", shared = false) {
      const keys = await this.list(prefix, shared);
      const values = await Promise.all(keys.map(async (key) => ({ key, value: await this.get(key, shared) })));
      return values;
    }
  };
}

export function createUpstashKvDriverFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createUpstashKvDriver({
    url: env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL,
    token: env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN,
    fetchImpl
  });
}
