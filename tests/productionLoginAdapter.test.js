import { describe, expect, it, vi } from "vitest";
import {
  changeProductionPassword,
  cmmsSessionFromProductionUser,
  createFirstRunAdmin,
  createProductionAuthStore,
  createProductionLoginClient,
  completeProductionInitialPassword,
  fetchFirstRunInstallState,
  loginWithProductionPassword,
  loginWithProductionPin,
  restoreProductionSession,
  productionAuthFromSupabase,
  productionLoginConfigFromEnv,
  productionLoginReady,
  updateProductionNotificationReadState,
  updateProductionProfile,
  validateProductionInitialPassword
} from "../src/productionLoginAdapter.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key)
  };
}

describe("productionLoginAdapter", () => {
  it("reads public Supabase login config and keeps login disabled until configured", () => {
    expect(productionLoginConfigFromEnv({ VITE_SUPABASE_URL: " https://supabase.example/// ", VITE_SUPABASE_ANON_KEY: "anon" })).toEqual({
      supabaseUrl: "https://supabase.example",
      supabaseAnonKey: "anon",
      authMode: "cookie",
      loginApiUrl: "/api/session/login",
      logoutApiUrl: "/api/session/logout",
      sessionApiUrl: "/api/session/me",
      profileApiUrl: "/api/session/profile",
      changePasswordApiUrl: "/api/session/change-password",
      initialPasswordApiUrl: "/api/session/initial-password",
      installApiUrl: "/api/install"
    });
    expect(productionLoginReady(productionLoginConfigFromEnv({}))).toBe(false);
    expect(productionLoginReady(productionLoginConfigFromEnv({ VITE_SUPABASE_URL: "https://supabase.example", VITE_SUPABASE_ANON_KEY: "anon" }))).toBe(true);
  });

  it("maps server session user into the current CMMS session shape", () => {
    expect(cmmsSessionFromProductionUser({
      id: "app-user-1",
      authUserId: "auth-user-1",
      name: "Owner",
      role: "admin",
      email: "owner@example.com",
      phone: "050-1234567",
      department: "הנהלה",
      departments: ["הנהלה"],
      permissions: { users: "manage" },
      mustChangePassword: true
    })).toMatchObject({
      id: "app-user-1",
      authUserId: "auth-user-1",
      name: "Owner",
      role: "admin",
      dept: "הנהלה",
      depts: ["הנהלה"],
      email: "owner@example.com",
      phone: "050-1234567",
      perms: { users: "manage" },
      mustChangePassword: true,
      productionSession: true
    });
  });

  it("reads first-run install state from the CMMS install endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({ ok: true, state: "new" });
      }
    });

    await expect(fetchFirstRunInstallState({
      config: { installApiUrl: "/api/install" },
      fetchImpl
    })).resolves.toEqual({ ok: true, state: "new", reason: "" });

    expect(fetchImpl).toHaveBeenCalledWith("/api/install", expect.objectContaining({
      method: "GET",
      credentials: "include",
      cache: "no-store"
    }));
  });

  it("creates first-run admin only through the CMMS install endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({ ok: true, state: "ready", admin: { id: "app-user-1", email: "owner@example.com", role: "admin", active: true } });
      }
    });

    await expect(createFirstRunAdmin({
      name: "Owner",
      email: "owner@example.com",
      password: "long-password",
      confirmPassword: "long-password",
      config: { installApiUrl: "/api/install" },
      fetchImpl
    })).resolves.toMatchObject({ ok: true, state: "ready" });

    expect(fetchImpl).toHaveBeenCalledWith("/api/install", expect.objectContaining({
      method: "POST",
      credentials: "include",
      headers: expect.objectContaining({ "content-type": "application/json" })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      name: "Owner",
      email: "owner@example.com",
      password: "long-password",
      confirmPassword: "long-password"
    });
  });

  it("keeps first-login worker dept and cleaning access in the CMMS session shape", () => {
    expect(cmmsSessionFromProductionUser({
      id: "worker-1",
      name: "Cleaner Worker",
      role: "worker",
      workerNo: "1234",
      dept: "ניקיון",
      depts: ["ניקיון"],
      cleaningAccess: { enabled: true, canPerformRounds: true }
    })).toMatchObject({
      id: "worker-1",
      role: "worker",
      workerNo: "1234",
      dept: "ניקיון",
      depts: ["ניקיון"],
      cleaningAccess: { enabled: true, canPerformRounds: true }
    });
  });

  it("signs in through the CMMS cookie login endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({
          ok: true,
          user: {
            id: "app-user-1",
            authUserId: "auth-user-1",
            email: "owner@example.com",
            name: "Owner",
            role: "admin",
            permissions: {},
            mustChangePassword: false
          },
          auth: { cookieSession: true, expiresAt: 1800000000000 }
        });
      }
    });
    const client = createProductionLoginClient({
      config: {
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon-key",
        authMode: "cookie",
        loginApiUrl: "/api/session/login",
        sessionApiUrl: "/api/session/me"
      },
      fetchImpl
    });

    const result = await client.signInWithPassword({ email: "OWNER@Example.COM", password: "secret" });

    expect(result.session).toMatchObject({
      id: "app-user-1",
      authUserId: "auth-user-1",
      email: "owner@example.com",
      role: "admin",
      productionSession: true
    });
    expect(result.accessToken).toBe("");
    expect(result.auth).toMatchObject({ accessToken: "", cookieSession: true });
    expect(fetchImpl).toHaveBeenCalledWith("/api/session/login", expect.objectContaining({
      method: "POST",
      credentials: "include",
      headers: expect.objectContaining({ "content-type": "application/json" })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      email: "owner@example.com",
      password: "secret",
      remember: false
    });
  });

  it("fails closed when production login is not configured", async () => {
    await expect(loginWithProductionPassword({ email: "owner@example.com", password: "secret", config: {} }))
      .rejects.toThrow("production_login_not_configured");
  });

  it("changes a mandatory production password through the CMMS endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({
          ok: true,
          user: {
            id: "app-user-1",
            authUserId: "auth-user-1",
            email: "owner@example.com",
            name: "Owner",
            role: "admin",
            permissions: {},
            mustChangePassword: false
          }
        });
      }
    });

    const result = await changeProductionPassword({
      accessToken: "access-token",
      newPassword: "new-long-password",
      config: {
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon-key",
        sessionApiUrl: "/api/session/me",
        changePasswordApiUrl: "/api/session/change-password"
      },
      fetchImpl
    });

    expect(result.session).toMatchObject({
      id: "app-user-1",
      authUserId: "auth-user-1",
      mustChangePassword: false,
      productionSession: true
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/session/change-password", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Bearer access-token" }),
      body: JSON.stringify({ newPassword: "new-long-password" })
    }));
  });

  it("updates the current production profile through the CMMS endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({
          ok: true,
          user: {
            id: "app-user-1",
            authUserId: "auth-user-1",
            email: "owner2@example.com",
            phone: "050-7654321",
            name: "Owner",
            role: "admin",
            permissions: {},
            mustChangePassword: false
          }
        });
      }
    });

    const result = await updateProductionProfile({
      accessToken: "access-token",
      email: "owner2@example.com",
      phone: "050-7654321",
      config: {
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon-key",
        sessionApiUrl: "/api/session/me",
        profileApiUrl: "/api/session/profile"
      },
      fetchImpl
    });

    expect(result.session).toMatchObject({
      id: "app-user-1",
      email: "owner2@example.com",
      phone: "050-7654321",
      productionSession: true
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/session/profile", expect.objectContaining({
      method: "PATCH",
      headers: expect.objectContaining({ authorization: "Bearer access-token" }),
      body: JSON.stringify({ email: "owner2@example.com", phone: "050-7654321" })
    }));
  });

  it("updates notification read-state through the CMMS profile endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({
          ok: true,
          user: {
            id: "app-user-1",
            authUserId: "auth-user-1",
            name: "Owner",
            role: "admin",
            notificationPrefs: { readState: { seenAt: 2000, seenKeys: ["n-1"] } },
            mustChangePassword: false
          }
        });
      }
    });

    const result = await updateProductionNotificationReadState({
      accessToken: "access-token",
      notificationReadState: { seenAt: 2000, seenKeys: ["n-1"] },
      config: {
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon-key",
        sessionApiUrl: "/api/session/me",
        profileApiUrl: "/api/session/profile"
      },
      fetchImpl
    });

    expect(result.session.notificationPrefs).toEqual({ readState: { seenAt: 2000, seenKeys: ["n-1"] } });
    expect(fetchImpl).toHaveBeenCalledWith("/api/session/profile", expect.objectContaining({
      method: "PATCH",
      headers: expect.objectContaining({ authorization: "Bearer access-token" }),
      body: JSON.stringify({ notificationReadState: { seenAt: 2000, seenKeys: ["n-1"] } })
    }));
  });

  it("stores production auth in session or local storage based on remember", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    const authStore = createProductionAuthStore({ key: "auth", local, session });

    authStore.set({ accessToken: "session-token" }, { remember: false });
    expect(JSON.parse(session.getItem("auth")).accessToken).toBe("session-token");
    expect(local.getItem("auth")).toBe(null);

    authStore.set({ accessToken: "local-token" }, { remember: true });
    expect(JSON.parse(local.getItem("auth")).accessToken).toBe("local-token");
    expect(session.getItem("auth")).toBe(null);

    authStore.clear();
    expect(authStore.get()).toBe(null);
  });

  it("stores Supabase expires_at seconds as milliseconds", () => {
    expect(productionAuthFromSupabase({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_at: 1_800_000_000
    }, 1_700_000_000_000)).toMatchObject({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 1_800_000_000_000
    });
  });

  it("normalizes legacy stored auth expiry from seconds", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    local.setItem("auth", JSON.stringify({
      accessToken: "legacy-token",
      refreshToken: "legacy-refresh",
      expiresAt: 1_800_000_000,
      remember: true
    }));
    const authStore = createProductionAuthStore({ key: "auth", local, session });

    expect(authStore.get()).toMatchObject({
      accessToken: "legacy-token",
      refreshToken: "legacy-refresh",
      expiresAt: 1_800_000_000_000,
      remember: true
    });
  });

  it("restores a production session through the session endpoint", async () => {
    const authStore = {
      get: vi.fn().mockReturnValue({ accessToken: "access-token", refreshToken: "refresh-token", remember: true }),
      set: vi.fn(),
      clear: vi.fn()
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({
          ok: true,
          user: { id: "app-user-1", authUserId: "auth-user-1", name: "Owner", role: "admin", mustChangePassword: false }
        });
      }
    });

    const restored = await restoreProductionSession({
      config: {
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon-key",
        sessionApiUrl: "/api/session/me"
      },
      authStore,
      fetchImpl
    });

    expect(restored.session).toMatchObject({ id: "app-user-1", productionSession: true });
    expect(fetchImpl).toHaveBeenCalledWith("/api/session/me", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer access-token" })
    }));
    expect(authStore.set).not.toHaveBeenCalled();
    expect(authStore.clear).not.toHaveBeenCalled();
  });

  it("refreshes expired production auth before restoring the session", async () => {
    const authStore = {
      get: vi.fn().mockReturnValue({ accessToken: "old-token", refreshToken: "refresh-token", remember: true }),
      set: vi.fn(),
      clear: vi.fn()
    };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, async text() { return JSON.stringify({ error: "expired" }); } })
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify({ access_token: "new-token", refresh_token: "new-refresh", expires_in: 3600 }); } })
      .mockResolvedValueOnce({
        ok: true,
        async text() {
          return JSON.stringify({
            ok: true,
            user: { id: "app-user-1", authUserId: "auth-user-1", name: "Owner", role: "admin", mustChangePassword: false }
          });
        }
      });

    const restored = await restoreProductionSession({
      config: {
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon-key",
        sessionApiUrl: "/api/session/me"
      },
      authStore,
      fetchImpl
    });

    expect(restored.session.id).toBe("app-user-1");
    expect(authStore.set).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: "new-token",
      refreshToken: "new-refresh"
    }), { remember: true });
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/auth/v1/token?grant_type=refresh_token", expect.objectContaining({
      method: "POST",
      signal: expect.any(Object),
      body: JSON.stringify({ refresh_token: "refresh-token" })
    }));
  });

  it("validates a first-password setup request by identifier", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({
          ok: true,
          needsSetup: true,
          auth: "password",
          identifierType: "email",
          user: { name: "Manager", role: "user", email: "manager@example.com" }
        });
      }
    });

    const result = await validateProductionInitialPassword({
      identifier: "manager@example.com",
      config: {
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon-key",
        sessionApiUrl: "/api/session/me",
        initialPasswordApiUrl: "/api/session/initial-password"
      },
      fetchImpl
    });

    expect(result).toMatchObject({ ok: true, needsSetup: true, auth: "password" });
    expect(fetchImpl).toHaveBeenCalledWith("/api/session/initial-password", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "validate", identifier: "manager@example.com" })
    }));
  });

  it("preserves first-login server payload when the secret already exists", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      async text() {
        return JSON.stringify({
          error: "initial_secret_already_configured",
          auth: "pin",
          user: { name: "Worker One", role: "worker", workerNo: "1042" }
        });
      }
    });

    await expect(validateProductionInitialPassword({
      identifier: "1042",
      config: {
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon-key",
        sessionApiUrl: "/api/session/me",
        initialPasswordApiUrl: "/api/session/initial-password"
      },
      fetchImpl
    })).rejects.toMatchObject({
      message: "initial_secret_already_configured",
      status: 409,
      data: {
        auth: "pin",
        user: { workerNo: "1042" }
      }
    });
  });

  it("logs in a worker through the PIN login action", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({
          ok: true,
          auth: null,
          pinSessionToken: "cmms-pin-token",
          pinSessionExpiresAt: 999999,
          user: {
            id: "worker-1",
            name: "Worker One",
            role: "worker",
            workerNo: "1042",
            permissions: {},
            mustChangePassword: false
          }
        });
      }
    });

    const result = await loginWithProductionPin({
      identifier: "1042",
      pin: "1234",
      config: {
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon-key",
        sessionApiUrl: "/api/session/me",
        initialPasswordApiUrl: "/api/session/initial-password"
      },
      fetchImpl
    });

    expect(result.session).toMatchObject({
      id: "worker-1",
      workerNo: "1042",
      role: "worker",
      productionSession: true
    });
    expect(result.auth).toEqual({
      accessToken: "cmms-pin-token",
      refreshToken: null,
      expiresAt: 999999,
      tokenType: "cmms-pin"
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/session/initial-password", expect.objectContaining({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ action: "login", identifier: "1042", pin: "1234", remember: false })
    }));
  });

  it("completes first-password setup and returns production auth", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({
          ok: true,
          user: {
            id: "app-user-1",
            authUserId: "auth-user-1",
            email: "manager@example.com",
            name: "Manager",
            role: "user",
            permissions: {},
            mustChangePassword: false
          },
          auth: {
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600
          }
        });
      }
    });

    const result = await completeProductionInitialPassword({
      identifier: "manager@example.com",
      password: "123456",
      config: {
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon-key",
        sessionApiUrl: "/api/session/me",
        initialPasswordApiUrl: "/api/session/initial-password"
      },
      fetchImpl
    });

    expect(result.session).toMatchObject({
      id: "app-user-1",
      email: "manager@example.com",
      role: "user",
      productionSession: true
    });
    expect(result.auth).toMatchObject({ accessToken: "access-token" });
    expect(fetchImpl).toHaveBeenCalledWith("/api/session/initial-password", expect.objectContaining({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ action: "complete", identifier: "manager@example.com", pin: undefined, password: "123456", remember: false })
    }));
  });
});
