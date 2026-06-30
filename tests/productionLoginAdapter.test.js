import { describe, expect, it, vi } from "vitest";
import {
  changeProductionPassword,
  cmmsSessionFromProductionUser,
  createProductionAuthStore,
  createProductionLoginClient,
  loginWithProductionPassword,
  restoreProductionSession,
  productionAuthFromSupabase,
  productionLoginConfigFromEnv,
  productionLoginReady,
  updateProductionProfile
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
      sessionApiUrl: "/api/session/me",
      profileApiUrl: "/api/session/profile",
      changePasswordApiUrl: "/api/session/change-password"
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

  it("signs in through Supabase Auth and then asks the CMMS session endpoint", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        async text() {
          return JSON.stringify({ access_token: "access-token" });
        }
      })
      .mockResolvedValueOnce({
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
    const client = createProductionLoginClient({
      config: {
        supabaseUrl: "https://supabase.example",
        supabaseAnonKey: "anon-key",
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
    expect(result.accessToken).toBe("access-token");
    expect(result.auth).toMatchObject({ accessToken: "access-token" });
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/auth/v1/token?grant_type=password", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ apikey: "anon-key" })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      email: "owner@example.com",
      password: "secret"
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/session/me", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({ authorization: "Bearer access-token" })
    }));
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
      body: JSON.stringify({ refresh_token: "refresh-token" })
    }));
  });
});
