import { createSupabaseKvDriverFromEnv } from "../kv/supabaseDriver.js";
import { createUpstashKvDriverFromEnv } from "../kv/upstashDriver.js";

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

const parseStoredUser = (record) => {
  if (!record?.value) return null;
  try {
    const user = JSON.parse(record.value);
    return user && typeof user === "object" ? { key: record.key, user } : null;
  } catch {
    return null;
  }
};

const isActivatableWorker = (user, token) => (
  (user?.role === "worker" || user?.role === "cleaner")
  && user.active !== false
  && user.activationStatus === "pending"
  && user.activationToken === token
);

const publicActivationUser = (user = {}) => ({
  name: user.name || "",
  role: user.role || "worker",
  workerNo: user.workerNo || ""
});

const publicActivatedSession = (user = {}) => ({
  id: user.id || "",
  name: user.name || "",
  role: user.role || "worker",
  dept: user.dept || "",
  depts: Array.isArray(user.depts) ? user.depts : (user.dept ? [user.dept] : []),
  email: user.email || "",
  phone: user.phone || "",
  workerNo: user.workerNo || "",
  supplier: user.supplier || "",
  shiftStart: user.shiftStart || "",
  shiftEnd: user.shiftEnd || "16:30",
  shiftId: user.shiftId || "",
  techScope: user.techScope || "transport",
  techCats: Array.isArray(user.techCats) ? user.techCats : [],
  mgrZones: Array.isArray(user.mgrZones) ? user.mgrZones : [],
  shift: user.shift || "",
  perms: user.perms || user.permissions || {}
});

async function findActivationRecord(driver, token) {
  const records = await driver.listValues("user:", true);
  return (records || [])
    .map(parseStoredUser)
    .filter(Boolean)
    .find(({ user }) => isActivatableWorker(user, token));
}

function createDefaultDriver(env, fetchImpl) {
  return (env.CMMS_KV_DRIVER === "upstash" ? createUpstashKvDriverFromEnv(env, fetchImpl) : null)
    || (env.CMMS_KV_DRIVER === "supabase" ? createSupabaseKvDriverFromEnv(env, fetchImpl) : null);
}

export function createWorkerActivationHandler({
  driver = null,
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now
} = {}) {
  const backendDriver = driver || createDefaultDriver(env, fetchImpl);

  return async function workerActivationHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "POST") {
      res.setHeader("allow", "POST");
      return json(res, 405, { error: "method_not_allowed" });
    }
    if (!backendDriver) return json(res, 503, { error: "activation_backend_not_configured" });

    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }

    const token = String(body?.token || "").trim();
    const action = body?.action === "activate" ? "activate" : "validate";
    if (token.length < 8 || token.length > 256) return json(res, 400, { error: "activation_token_invalid" });

    const record = await findActivationRecord(backendDriver, token);
    if (!record) return json(res, 404, { error: "activation_link_invalid" });

    if (action === "validate") {
      return json(res, 200, { ok: true, user: publicActivationUser(record.user) });
    }

    const pin = String(body?.pin || "").trim();
    if (pin.length < 4) return json(res, 400, { error: "pin_too_short" });

    const updated = {
      ...record.user,
      pin,
      activationToken: "",
      activationStatus: "activated",
      activatedAt: now()
    };
    const key = record.key || `user:${updated.id}`;
    await backendDriver.set(key, JSON.stringify(updated), true);
    return json(res, 200, { ok: true, user: publicActivatedSession(updated) });
  };
}

export default createWorkerActivationHandler();
