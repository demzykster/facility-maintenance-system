const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
};

const parseBool = (value) => value === true || value === "1" || value === "true";

function isAuthorized(req, env) {
  if (env.CMMS_KV_ALLOW_UNAUTHENTICATED === "true") return true;
  const token = env.CMMS_KV_BEARER_TOKEN;
  if (!token) return false;
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  return header === `Bearer ${token}`;
}

export function createKvApiHandler({ driver = null, env = process.env } = {}) {
  return async function kvApiHandler(req, res) {
    if (!isAuthorized(req, env)) {
      return json(res, 503, { error: "storage_auth_not_configured" });
    }
    if (!driver) {
      return json(res, 503, { error: "storage_backend_not_configured" });
    }

    try {
      const method = String(req.method || "GET").toUpperCase();
      const query = req.query || {};
      const key = Array.isArray(query.key) ? query.key.join("/") : query.key;
      const shared = parseBool(query.shared);

      if (!key && method === "GET") {
        const prefix = String(query.prefix || "");
        const keys = await driver.list(prefix, shared);
        return json(res, 200, { keys });
      }
      if (!key) return json(res, 400, { error: "key_required" });

      if (method === "GET") {
        const value = await driver.get(key, shared);
        return json(res, 200, value === null || value === undefined ? null : { value });
      }
      if (method === "PUT") {
        const body = await readBody(req);
        await driver.set(key, body?.value ?? "", parseBool(body?.shared ?? shared));
        return json(res, 200, { ok: true });
      }
      if (method === "DELETE") {
        await driver.delete(key, shared);
        return json(res, 200, { ok: true });
      }

      res.setHeader("allow", key ? "GET, PUT, DELETE" : "GET");
      return json(res, 405, { error: "method_not_allowed" });
    } catch (error) {
      return json(res, 500, { error: error?.message || "storage_api_error" });
    }
  };
}

export default createKvApiHandler();
