import { describe, expect, it, vi } from "vitest";
import {
  cmmsSessionFromProductionUser,
  createProductionLoginClient,
  loginWithProductionPassword,
  productionLoginConfigFromEnv,
  productionLoginReady
} from "../src/productionLoginAdapter.js";

describe("productionLoginAdapter", () => {
  it("reads public Supabase login config and keeps login disabled until configured", () => {
    expect(productionLoginConfigFromEnv({ VITE_SUPABASE_URL: " https://supabase.example/// ", VITE_SUPABASE_ANON_KEY: "anon" })).toEqual({
      supabaseUrl: "https://supabase.example",
      supabaseAnonKey: "anon",
      sessionApiUrl: "/api/session/me"
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
});
