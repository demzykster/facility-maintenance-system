const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function productionLoginConfigFromEnv(env = {}) {
  return {
    supabaseUrl: trimSlash(env.VITE_SUPABASE_URL || env.SUPABASE_URL),
    supabaseAnonKey: String(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "").trim(),
    sessionApiUrl: String(env.VITE_CMMS_SESSION_API_URL || "/api/session/me").trim() || "/api/session/me",
    changePasswordApiUrl: String(env.VITE_CMMS_CHANGE_PASSWORD_API_URL || "/api/session/change-password").trim() || "/api/session/change-password"
  };
}

export function productionLoginReady(config = {}) {
  return !!(config.supabaseUrl && config.supabaseAnonKey && config.sessionApiUrl);
}

export function cmmsSessionFromProductionUser(user = {}) {
  return {
    id: user.id || user.appUserId || "",
    authUserId: user.authUserId || "",
    name: user.name || user.email || "",
    role: user.role || "user",
    dept: user.department || "",
    depts: Array.isArray(user.departments) ? user.departments : (user.department ? [user.department] : []),
    email: user.email || "",
    workerNo: user.workerNo || "",
    supplier: user.supplier || "",
    shiftStart: user.shiftStart || "",
    shiftEnd: user.shiftEnd || "16:30",
    shiftId: user.shiftId || "",
    techScope: user.techScope || "transport",
    techCats: Array.isArray(user.techCats) ? user.techCats : [],
    mgrZones: Array.isArray(user.mgrZones) ? user.mgrZones : [],
    shift: user.shift || "",
    perms: user.permissions || user.perms || {},
    mustChangePassword: user.mustChangePassword === true,
    productionSession: true
  };
}

export function createProductionLoginClient({ config, fetchImpl = globalThis.fetch } = {}) {
  if (!productionLoginReady(config) || !fetchImpl) return null;
  const { supabaseUrl, supabaseAnonKey, sessionApiUrl } = config;

  return {
    async signInWithPassword({ email, password }) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail || !password) throw new Error("email_and_password_required");

      const authResponse = await fetchImpl(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          "content-type": "application/json"
        },
        body: JSON.stringify({ email: normalizedEmail, password })
      });
      const authData = await readJson(authResponse);
      if (!authResponse.ok || !authData?.access_token) {
        throw new Error(authData?.message || authData?.msg || authData?.error_description || authData?.error || "supabase_login_failed");
      }

      const sessionResponse = await fetchImpl(sessionApiUrl, {
        method: "GET",
        headers: {
          authorization: `Bearer ${authData.access_token}`,
          "content-type": "application/json"
        }
      });
      const sessionData = await readJson(sessionResponse);
      if (!sessionResponse.ok || !sessionData?.ok) {
        throw new Error(sessionData?.error || "cmms_session_failed");
      }

      return {
        session: cmmsSessionFromProductionUser(sessionData.user),
        accessToken: authData.access_token,
        mustChangePassword: sessionData.user?.mustChangePassword === true
      };
    },
    async changePassword({ accessToken, newPassword }) {
      if (!accessToken || !newPassword) throw new Error("access_token_and_password_required");
      const response = await fetchImpl(config.changePasswordApiUrl || "/api/session/change-password", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await readJson(response);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "password_change_failed");
      }
      return {
        session: cmmsSessionFromProductionUser(data.user),
        mustChangePassword: data.user?.mustChangePassword === true
      };
    }
  };
}

export async function loginWithProductionPassword({ email, password, config, fetchImpl } = {}) {
  const client = createProductionLoginClient({ config, fetchImpl });
  if (!client) throw new Error("production_login_not_configured");
  return client.signInWithPassword({ email, password });
}

export async function changeProductionPassword({ accessToken, newPassword, config, fetchImpl } = {}) {
  const client = createProductionLoginClient({ config, fetchImpl });
  if (!client) throw new Error("production_login_not_configured");
  return client.changePassword({ accessToken, newPassword });
}
