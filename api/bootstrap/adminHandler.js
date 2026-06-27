const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const parseEnabled = (value) => value === true || value === "1" || value === "true";

const getHeader = (headers = {}, name) => {
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (direct) return direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match ? match[1] : "";
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizeName = (name) => String(name || "").trim() || "מנהל מערכת";

export function validateBootstrapAdminPayload(body = {}) {
  const email = normalizeEmail(body.email);
  const temporaryPassword = String(body.temporaryPassword || body.password || "");
  const name = normalizeName(body.name);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "valid_email_required" };
  }
  if (temporaryPassword.length < 12) {
    return { ok: false, error: "temporary_password_min_12_chars" };
  }

  return {
    ok: true,
    admin: {
      email,
      temporaryPassword,
      name,
      role: "admin",
      active: true,
      mustChangePassword: true,
      bootstrap: true
    }
  };
}

export function bootstrapAuthorization(req, env = {}) {
  const configuredToken = String(env.CMMS_BOOTSTRAP_TOKEN || "");
  if (!configuredToken) return { ok: false, status: 503, error: "bootstrap_auth_not_configured" };

  const bearer = String(getHeader(req.headers, "authorization") || "");
  const headerToken = String(getHeader(req.headers, "x-cmms-bootstrap-token") || "");
  const requestToken = bearer.startsWith("Bearer ") ? bearer.slice(7) : headerToken;

  if (requestToken !== configuredToken) return { ok: false, status: 401, error: "bootstrap_unauthorized" };
  return { ok: true };
}

async function responseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function createSupabaseAdminBootstrapClient({ url, serviceRoleKey, fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");

  return {
    async createAdmin(admin) {
      const response = await fetchImpl(`${root}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email: admin.email,
          password: admin.temporaryPassword,
          email_confirm: true,
          user_metadata: {
            name: admin.name,
            role: "admin",
            cmms_role: "admin",
            cmms_bootstrap: true,
            must_change_password: true
          },
          app_metadata: {
            role: "admin",
            cmms_role: "admin"
          }
        })
      });

      const data = await responseJson(response);
      if (!response.ok) {
        throw new Error(data?.message || data?.msg || data?.error_description || data?.error || `supabase_auth_${response.status}`);
      }

      const user = data?.user || data;
      return {
        id: user?.id || "",
        email: user?.email || admin.email,
        role: "admin",
        mustChangePassword: true
      };
    }
  };
}

export function createBootstrapAdminHandler({
  env = process.env,
  supabaseClient = null,
  fetchImpl = globalThis.fetch
} = {}) {
  return async function bootstrapAdminHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "POST") {
      res.setHeader("allow", "POST");
      return json(res, 405, { error: "method_not_allowed" });
    }

    if (!parseEnabled(env.CMMS_BOOTSTRAP_ENABLED)) {
      return json(res, 503, { error: "bootstrap_disabled" });
    }

    const auth = bootstrapAuthorization(req, env);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    const client = supabaseClient || createSupabaseAdminBootstrapClient({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      fetchImpl
    });
    if (!client) return json(res, 503, { error: "supabase_admin_not_configured" });

    try {
      const body = await readBody(req);
      const validated = validateBootstrapAdminPayload(body);
      if (!validated.ok) return json(res, 400, { error: validated.error });

      const admin = await client.createAdmin(validated.admin);
      return json(res, 200, {
        ok: true,
        admin,
        disableBootstrapAfterSuccess: true
      });
    } catch (error) {
      return json(res, 500, { error: error?.message || "bootstrap_admin_error" });
    }
  };
}

export default createBootstrapAdminHandler();
