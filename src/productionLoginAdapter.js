const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const DEFAULT_AUTH_REQUEST_TIMEOUT_MS = 10_000;

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
  const hasSupabaseEnv = !!(env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY);
  return {
    supabaseUrl: trimSlash(env.VITE_SUPABASE_URL || env.SUPABASE_URL),
    supabaseAnonKey: String(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "").trim(),
    authMode: String(env.VITE_CMMS_AUTH_MODE || (hasSupabaseEnv ? "cookie" : "")).trim().toLowerCase(),
    loginApiUrl: String(env.VITE_CMMS_LOGIN_API_URL || "/api/session/login").trim() || "/api/session/login",
    logoutApiUrl: String(env.VITE_CMMS_LOGOUT_API_URL || "/api/session/logout").trim() || "/api/session/logout",
    sessionApiUrl: String(env.VITE_CMMS_SESSION_API_URL || "/api/session/me").trim() || "/api/session/me",
    profileApiUrl: String(env.VITE_CMMS_PROFILE_API_URL || "/api/session/profile").trim() || "/api/session/profile",
    changePasswordApiUrl: String(env.VITE_CMMS_CHANGE_PASSWORD_API_URL || "/api/session/change-password").trim() || "/api/session/change-password",
    initialPasswordApiUrl: String(env.VITE_CMMS_INITIAL_PASSWORD_API_URL || "/api/session/initial-password").trim() || "/api/session/initial-password"
  };
}

export function productionLoginReady(config = {}) {
  const mode = config.authMode || (config.supabaseUrl || config.supabaseAnonKey ? "cookie" : "");
  if (mode === "direct") return !!(config.supabaseUrl && config.supabaseAnonKey && config.sessionApiUrl);
  if (mode === "cookie") return !!((config.loginApiUrl || "/api/session/login") && (config.sessionApiUrl || "/api/session/me"));
  return false;
}

export function normalizeAuthExpiresAt(value) {
  const numeric = Number(value || 0);
  if (!numeric) return 0;
  return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
}

export function productionAuthFromSupabase(data = {}, now = Date.now()) {
  const expiresIn = Number(data.expires_in || 0);
  const expiresAt = normalizeAuthExpiresAt(data.expires_at);
  return {
    accessToken: data.access_token || "",
    refreshToken: data.refresh_token || "",
    expiresAt: expiresAt || (expiresIn ? now + expiresIn * 1000 : 0),
    tokenType: data.token_type || "bearer"
  };
}

export function productionAuthFromCookie(data = {}, now = Date.now()) {
  const expiresAt = normalizeAuthExpiresAt(data.expiresAt || data.expires_at);
  return {
    accessToken: "",
    refreshToken: "",
    expiresAt: expiresAt || (data.expires_in ? now + Number(data.expires_in) * 1000 : 0),
    tokenType: "cookie",
    cookieSession: true
  };
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = DEFAULT_AUTH_REQUEST_TIMEOUT_MS) {
  const ms = Number(timeoutMs || 0);
  if (!ms || typeof AbortController === "undefined") return fetchImpl(url, options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetchImpl(url, { ...options, signal: options.signal || controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("supabase_request_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
    perms: user.permissions || user.perms || {},
    mustChangePassword: user.mustChangePassword === true,
    productionSession: true
  };
}

export function createProductionLoginClient({ config, fetchImpl = globalThis.fetch } = {}) {
  if (!productionLoginReady(config) || !fetchImpl) return null;
  const { supabaseUrl, supabaseAnonKey, sessionApiUrl } = config;

  async function sessionFromAccessToken(accessToken) {
    const sessionResponse = await fetchImpl(sessionApiUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        "content-type": "application/json"
      }
    });
    const sessionData = await readJson(sessionResponse);
    if (!sessionResponse.ok || !sessionData?.ok) {
      throw new Error(sessionData?.error || "cmms_session_failed");
    }
    return {
      session: cmmsSessionFromProductionUser(sessionData.user),
      mustChangePassword: sessionData.user?.mustChangePassword === true
    };
  }

  return {
    async signInWithPassword({ email, password, remember = false }) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail || !password) throw new Error("email_and_password_required");

      if (config.authMode !== "direct") {
        const loginResponse = await fetchImpl(config.loginApiUrl || "/api/session/login", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password, remember: remember === true })
        });
        const loginData = await readJson(loginResponse);
        if (!loginResponse.ok || !loginData?.ok) {
          throw new Error(loginData?.error || "cmms_login_failed");
        }
        const auth = productionAuthFromCookie(loginData.auth || {});
        return {
          session: cmmsSessionFromProductionUser(loginData.user),
          mustChangePassword: loginData.user?.mustChangePassword === true,
          auth,
          accessToken: auth.accessToken
        };
      }

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

      const auth = productionAuthFromSupabase(authData);
      const result = await sessionFromAccessToken(auth.accessToken);

      return {
        ...result,
        auth,
        accessToken: auth.accessToken
      };
    },
    sessionFromAccessToken,
    async refreshAuth(refreshToken) {
      if (!refreshToken) throw new Error("refresh_token_required");
      const response = await fetchWithTimeout(fetchImpl, `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          "content-type": "application/json"
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      const data = await readJson(response);
      if (!response.ok || !data?.access_token) {
        throw new Error(data?.message || data?.msg || data?.error_description || data?.error || "supabase_refresh_failed");
      }
      return productionAuthFromSupabase(data);
    },
    async changePassword({ accessToken, newPassword }) {
      if (!newPassword) throw new Error("access_token_and_password_required");
      const response = await fetchImpl(config.changePasswordApiUrl || "/api/session/change-password", {
        method: "POST",
        credentials: "include",
        headers: {
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
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
    },
    async updateProfile({ accessToken, email, phone }) {
      const response = await fetchImpl(config.profileApiUrl || "/api/session/profile", {
        method: "PATCH",
        credentials: "include",
        headers: {
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          "content-type": "application/json"
        },
        body: JSON.stringify({ email, phone })
      });
      const data = await readJson(response);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "profile_update_failed");
      }
      return {
        session: cmmsSessionFromProductionUser(data.user),
        mustChangePassword: data.user?.mustChangePassword === true
      };
    },
    async validateInitialPassword({ identifier }) {
      const response = await fetchImpl(config.initialPasswordApiUrl || "/api/session/initial-password", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "validate", identifier })
      });
      const data = await readJson(response);
      if (!response.ok || !data?.ok) {
        const error = new Error(data?.error || "initial_password_validate_failed");
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    },
    async signInWithPin({ identifier, pin, remember = false }) {
      const response = await fetchImpl(config.initialPasswordApiUrl || "/api/session/initial-password", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "login", identifier, pin, remember: remember === true })
      });
      const data = await readJson(response);
      if (!response.ok || !data?.ok) {
        const error = new Error(data?.error || "pin_login_failed");
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return {
        session: data.user ? cmmsSessionFromProductionUser(data.user) : null,
        auth: data.auth?.cookieSession
          ? productionAuthFromCookie(data.auth)
          : data.pinSessionToken
          ? { accessToken: data.pinSessionToken, refreshToken: null, expiresAt: data.pinSessionExpiresAt || 0, tokenType: "cmms-pin" }
          : null
      };
    },
    async completeInitialPassword({ identifier, pin, password, remember = false }) {
      const response = await fetchImpl(config.initialPasswordApiUrl || "/api/session/initial-password", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "complete", identifier, pin, password, remember: remember === true })
      });
      const data = await readJson(response);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "initial_password_failed");
      }
      return {
        session: data.user ? cmmsSessionFromProductionUser(data.user) : null,
        auth: data.auth
          ? (data.auth.cookieSession ? productionAuthFromCookie(data.auth) : productionAuthFromSupabase(data.auth))
          : (data.pinSessionToken
            ? { accessToken: data.pinSessionToken, refreshToken: null, expiresAt: data.pinSessionExpiresAt || 0, tokenType: "cmms-pin" }
            : null)
      };
    }
  };
}

export async function loginWithProductionPassword({ email, password, remember = false, config, fetchImpl } = {}) {
  const client = createProductionLoginClient({ config, fetchImpl });
  if (!client) throw new Error("production_login_not_configured");
  return client.signInWithPassword({ email, password, remember });
}

export async function changeProductionPassword({ accessToken, newPassword, config, fetchImpl } = {}) {
  const client = createProductionLoginClient({ config, fetchImpl });
  if (!client) throw new Error("production_login_not_configured");
  return client.changePassword({ accessToken, newPassword });
}

export async function updateProductionProfile({ accessToken, email, phone, config, fetchImpl } = {}) {
  const client = createProductionLoginClient({ config, fetchImpl });
  if (!client) throw new Error("production_login_not_configured");
  return client.updateProfile({ accessToken, email, phone });
}

export async function validateProductionInitialPassword({ identifier, config, fetchImpl } = {}) {
  const client = createProductionLoginClient({ config, fetchImpl });
  if (!client) throw new Error("production_login_not_configured");
  return client.validateInitialPassword({ identifier });
}

export async function completeProductionInitialPassword({ identifier, pin, password, remember = false, config, fetchImpl } = {}) {
  const client = createProductionLoginClient({ config, fetchImpl });
  if (!client) throw new Error("production_login_not_configured");
  return client.completeInitialPassword({ identifier, pin, password, remember });
}

export async function loginWithProductionPin({ identifier, pin, remember = false, config, fetchImpl } = {}) {
  const client = createProductionLoginClient({ config, fetchImpl });
  if (!client) throw new Error("production_login_not_configured");
  return client.signInWithPin({ identifier, pin, remember });
}

export async function logoutProductionSession({ config, fetchImpl = globalThis.fetch } = {}) {
  try {
    await fetchImpl(config?.logoutApiUrl || "/api/session/logout", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" }
    });
  } catch {}
}

export function createProductionAuthStore({ key = "cmms:productionAuth:v1", local = globalThis.localStorage, session = globalThis.sessionStorage } = {}) {
  const read = (storage) => {
    try {
      const raw = storage?.getItem?.(key);
      const auth = raw ? JSON.parse(raw) : null;
      return auth ? { ...auth, expiresAt: normalizeAuthExpiresAt(auth.expiresAt) } : null;
    } catch {
      return null;
    }
  };
  const remove = (storage) => {
    try { storage?.removeItem?.(key); } catch {}
  };
  return {
    get() {
      return read(session) || read(local);
    },
    set(auth, { remember = false } = {}) {
      this.clear();
      const payload = JSON.stringify({ ...auth, remember: remember === true });
      try { (remember ? local : session)?.setItem?.(key, payload); } catch {}
    },
    clear() {
      remove(local);
      remove(session);
    }
  };
}

export async function restoreProductionSession({ config, authStore = createProductionAuthStore(), fetchImpl } = {}) {
  const client = createProductionLoginClient({ config, fetchImpl });
  const auth = authStore?.get?.();
  if (!client || (!auth?.accessToken && !auth?.cookieSession)) return null;

  try {
    const result = await client.sessionFromAccessToken(auth.accessToken || "");
    if (result.mustChangePassword) {
      authStore.clear?.();
      return null;
    }
    return { ...result, auth };
  } catch (error) {
    if (auth.cookieSession) {
      authStore.clear?.();
      return null;
    }
    if (!auth.refreshToken) {
      authStore.clear?.();
      return null;
    }
    try {
      const refreshed = await client.refreshAuth(auth.refreshToken);
      authStore.set?.(refreshed, { remember: auth.remember === true });
      const result = await client.sessionFromAccessToken(refreshed.accessToken);
      if (result.mustChangePassword) {
        authStore.clear?.();
        return null;
      }
      return { ...result, auth: refreshed };
    } catch {
      authStore.clear?.();
      return null;
    }
  }
}
