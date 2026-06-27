import { describe, expect, it, vi } from "vitest";
import {
  createChangePasswordHandler,
  createSupabasePasswordChangeClient,
  validatePasswordChangePayload
} from "../api/session/changePasswordHandler.js";

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
  await handler({ headers: {}, method: "POST", body: {}, ...req }, res);
  return res;
}

describe("change password handler", () => {
  it("validates the new production password length", () => {
    expect(validatePasswordChangePayload({ newPassword: "short" })).toEqual({ ok: false, error: "new_password_min_12_chars" });
    expect(validatePasswordChangePayload({ newPassword: "long-password" })).toEqual({ ok: true, newPassword: "long-password" });
  });

  it("requires a bearer access token and configured Supabase client", async () => {
    const handler = createChangePasswordHandler({ env: {} });

    expect((await call(handler, {})).json()).toEqual({ error: "access_token_required" });

    const res = await call(handler, { headers: { authorization: "Bearer user-token" } });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "supabase_password_change_not_configured" });
  });

  it("changes only sessions flagged for mandatory password change", async () => {
    const passwordClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "admin@example.com" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "admin",
        name: "Owner",
        active: true,
        must_change_password: true
      }),
      updateAuthPassword: vi.fn().mockResolvedValue({}),
      clearMustChangePassword: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "admin",
        name: "Owner",
        active: true,
        must_change_password: false
      })
    };
    const handler = createChangePasswordHandler({ passwordClient });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { newPassword: "new-long-password" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      user: {
        id: "app-user-1",
        authUserId: "auth-user-1",
        mustChangePassword: false
      }
    });
    expect(passwordClient.updateAuthPassword).toHaveBeenCalledWith("user-token", "new-long-password");
    expect(passwordClient.clearMustChangePassword).toHaveBeenCalledWith("auth-user-1");
  });

  it("refuses password change when the profile is not flagged", async () => {
    const passwordClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({ id: "app-user-1", auth_user_id: "auth-user-1", role: "admin", name: "Owner", active: true, must_change_password: false }),
      updateAuthPassword: vi.fn(),
      clearMustChangePassword: vi.fn()
    };
    const handler = createChangePasswordHandler({ passwordClient });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { newPassword: "new-long-password" }
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "password_change_not_required" });
    expect(passwordClient.updateAuthPassword).not.toHaveBeenCalled();
  });

  it("uses anon bearer for user auth and service role only to clear the profile flag", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify({ id: "auth-user-1" }); } })
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify([{ id: "app-user-1", auth_user_id: "auth-user-1", role: "admin", name: "Owner", active: true, must_change_password: true }]); } })
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify({ id: "auth-user-1" }); } })
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify([{ id: "app-user-1", auth_user_id: "auth-user-1", must_change_password: false }]); } });
    const client = createSupabasePasswordChangeClient({
      url: "https://supabase.example/",
      anonKey: "anon-key",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await client.getAuthUser("user-token");
    await client.getAppUserProfile("user-token", "auth-user-1");
    await client.updateAuthPassword("user-token", "new-long-password");
    await client.clearMustChangePassword("auth-user-1");

    expect(fetchImpl.mock.calls[0]).toEqual(["https://supabase.example/auth/v1/user", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({ apikey: "anon-key", authorization: "Bearer user-token" })
    })]);
    expect(fetchImpl.mock.calls[2]).toEqual(["https://supabase.example/auth/v1/user", expect.objectContaining({
      method: "PUT",
      headers: expect.objectContaining({ apikey: "anon-key", authorization: "Bearer user-token" }),
      body: JSON.stringify({ password: "new-long-password" })
    })]);
    expect(fetchImpl.mock.calls[3]).toEqual(["https://supabase.example/rest/v1/app_users?auth_user_id=eq.auth-user-1", expect.objectContaining({
      method: "PATCH",
      headers: expect.objectContaining({ apikey: "service-key", authorization: "Bearer service-key" })
    })]);
  });
});
