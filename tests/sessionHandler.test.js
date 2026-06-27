import { describe, expect, it, vi } from "vitest";
import {
  buildSessionPayload,
  createSessionMeHandler,
  createSupabaseSessionClient
} from "../api/session/sessionHandler.js";

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
    },
    json() {
      return this.body ? JSON.parse(this.body) : null;
    }
  };
}

async function call(handler, req) {
  const res = createRes();
  await handler({ headers: {}, method: "GET", ...req }, res);
  return res;
}

describe("session handler", () => {
  it("requires a bearer access token", async () => {
    const handler = createSessionMeHandler({ env: {} });

    const res = await call(handler, {});

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "access_token_required" });
  });

  it("does not claim session lookup works before Supabase env is configured", async () => {
    const handler = createSessionMeHandler({ env: {} });

    const res = await call(handler, { headers: { authorization: "Bearer user-token" } });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "supabase_session_not_configured" });
  });

  it("builds a session from auth user and active app profile", () => {
    expect(buildSessionPayload({
      id: "auth-user-1",
      email: "admin@example.com"
    }, {
      auth_user_id: "auth-user-1",
      role: "admin",
      name: "Owner",
      email: "admin@example.com",
      active: true,
      permissions: { users: "manage" },
      must_change_password: true
    })).toEqual({
      ok: true,
      user: {
        authUserId: "auth-user-1",
        email: "admin@example.com",
        role: "admin",
        name: "Owner",
        workerNo: null,
        department: null,
        departments: [],
        permissions: { users: "manage" },
        mustChangePassword: true
      }
    });
  });

  it("rejects missing, mismatched, or disabled app profiles", () => {
    expect(buildSessionPayload({ id: "auth-user-1" }, null)).toEqual({ ok: false, error: "app_user_profile_missing" });
    expect(buildSessionPayload({ id: "auth-user-1" }, { role: "admin", name: "Owner" })).toEqual({ ok: false, error: "app_user_profile_auth_link_missing" });
    expect(buildSessionPayload({ id: "auth-user-1" }, { auth_user_id: "other", role: "admin", name: "Owner" })).toEqual({ ok: false, error: "app_user_profile_mismatch" });
    expect(buildSessionPayload({ id: "auth-user-1" }, { auth_user_id: "auth-user-1", role: "admin", name: "Owner", active: false })).toEqual({ ok: false, error: "app_user_disabled" });
  });

  it("serves the current session through the injected server client", async () => {
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "admin@example.com" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        auth_user_id: "auth-user-1",
        role: "admin",
        name: "Owner",
        email: "admin@example.com",
        active: true,
        permissions: {},
        must_change_password: false
      })
    };
    const handler = createSessionMeHandler({ sessionClient });

    const res = await call(handler, { headers: { authorization: "Bearer user-token" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      user: {
        authUserId: "auth-user-1",
        role: "admin",
        name: "Owner"
      }
    });
    expect(sessionClient.getAuthUser).toHaveBeenCalledWith("user-token");
    expect(sessionClient.getAppUserProfile).toHaveBeenCalledWith("user-token", "auth-user-1");
  });

  it("calls Supabase Auth and app_users REST with anon key plus user bearer token", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        async text() {
          return JSON.stringify({ id: "auth-user-1", email: "admin@example.com" });
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        async text() {
          return JSON.stringify([{ auth_user_id: "auth-user-1", role: "admin", name: "Owner", email: "admin@example.com", active: true }]);
        }
      });
    const client = createSupabaseSessionClient({
      url: "https://supabase.example/",
      anonKey: "anon-key",
      fetchImpl
    });

    const authUser = await client.getAuthUser("user-token");
    const profile = await client.getAppUserProfile("user-token", authUser.id);

    expect(authUser).toEqual({ id: "auth-user-1", email: "admin@example.com" });
    expect(profile).toMatchObject({ auth_user_id: "auth-user-1", role: "admin" });
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/auth/v1/user", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({
        apikey: "anon-key",
        authorization: "Bearer user-token"
      })
    }));
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/app_users?auth_user_id=eq.auth-user-1&select=*", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({
        apikey: "anon-key",
        authorization: "Bearer user-token"
      })
    }));
  });
});
