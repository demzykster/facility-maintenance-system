import { describe, expect, it, vi } from "vitest";
import {
  createProfileHandler,
  createSupabaseProfileUpdateClient,
  validateProfilePayload
} from "../server/session/profileHandler.js";
import { signCmmsSessionToken } from "../server/session/cmmsSessionToken.js";

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
  await handler({ headers: {}, method: "PATCH", body: {}, ...req }, res);
  return res;
}

describe("profile handler", () => {
  it("validates profile fields", () => {
    expect(validateProfilePayload({})).toEqual({ ok: false, error: "profile_patch_empty" });
    expect(validateProfilePayload({ email: "bad" })).toEqual({ ok: false, error: "email_invalid" });
    expect(validateProfilePayload({ phone: "1".repeat(41) })).toEqual({ ok: false, error: "phone_too_long" });
    expect(validateProfilePayload({ email: "OWNER@Example.COM", phone: "050-1234567" })).toEqual({
      ok: true,
      patch: { email: "owner@example.com", phone: "050-1234567" }
    });
    expect(validateProfilePayload({ notificationReadState: { seenAt: "1000", seenKeys: ["a", 1, "b"] } })).toEqual({
      ok: true,
      patch: { notificationReadState: { seenAt: 1000, seenKeys: ["a", "b"] } }
    });
  });

  it("requires bearer auth and configured Supabase client", async () => {
    const handler = createProfileHandler({ env: {} });

    expect((await call(handler, {})).json()).toEqual({ error: "access_token_required" });

    const res = await call(handler, { headers: { authorization: "Bearer user-token" } });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "supabase_profile_not_configured" });
  });

  it("updates phone and email for the current authenticated profile", async () => {
    const profileClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "owner@example.com" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "admin",
        name: "Owner",
        email: "owner@example.com",
        active: true,
        must_change_password: false
      }),
      updateAuthEmail: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "owner2@example.com" }),
      updateAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "admin",
        name: "Owner",
        email: "owner2@example.com",
        phone: "050-1234567",
        active: true,
        must_change_password: false
      })
    };
    const handler = createProfileHandler({ profileClient });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { email: "OWNER2@Example.COM", phone: "050-1234567" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      user: {
        id: "app-user-1",
        email: "owner2@example.com",
        phone: "050-1234567"
      }
    });
    expect(profileClient.updateAuthEmail).toHaveBeenCalledWith("auth-user-1", "owner2@example.com");
    expect(profileClient.updateAppUserProfile).toHaveBeenCalledWith("auth-user-1", {
      email: "owner2@example.com",
      phone: "050-1234567"
    });
  });

  it("updates current user notification read-state in app_users notification prefs", async () => {
    const profileClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "owner@example.com" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "admin",
        name: "Owner",
        email: "owner@example.com",
        active: true,
        notification_prefs: { enabled: { cleaning: false } },
        must_change_password: false
      }),
      updateAuthEmail: vi.fn(),
      updateAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "admin",
        name: "Owner",
        email: "owner@example.com",
        active: true,
        notification_prefs: { enabled: { cleaning: false }, readState: { seenAt: 2000, seenKeys: ["n-1"] } },
        must_change_password: false
      })
    };
    const handler = createProfileHandler({ profileClient });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { notificationReadState: { seenAt: 2000, seenKeys: ["n-1"] } }
    });

    expect(res.statusCode).toBe(200);
    expect(profileClient.updateAuthEmail).not.toHaveBeenCalled();
    expect(profileClient.updateAppUserProfile).toHaveBeenCalledWith("auth-user-1", {
      notification_prefs: { enabled: { cleaning: false }, readState: { seenAt: 2000, seenKeys: ["n-1"] } }
    });
    expect(res.json().user.notificationPrefs).toEqual({
      enabled: { cleaning: false },
      readState: { seenAt: 2000, seenKeys: ["n-1"] }
    });
  });

  it("updates notification read-state for CMMS PIN sessions without allowing contact changes", async () => {
    const token = signCmmsSessionToken("worker-1", "worker", "11032", "secret", Date.now()).token;
    const pinSessionClient = {
      findPinSessionUser: vi.fn().mockResolvedValue({
        id: "worker-1",
        workerNo: "11032",
        role: "worker",
        name: "Worker",
        active: true,
        notificationPrefs: { enabled: { ppe: false } }
      })
    };
    const profileClient = {
      updateAppUserProfileById: vi.fn().mockResolvedValue({
        id: "worker-1",
        notification_prefs: { enabled: { ppe: false }, readState: { seenAt: 3000, seenKeys: ["w-1"] } }
      })
    };
    const handler = createProfileHandler({
      env: { CMMS_SESSION_SECRET: "secret" },
      profileClient,
      pinSessionClient
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: { notificationReadState: { seenAt: 3000, seenKeys: ["w-1"] } }
    });

    expect(res.statusCode).toBe(200);
    expect(profileClient.updateAppUserProfileById).toHaveBeenCalledWith("worker-1", {
      notification_prefs: { enabled: { ppe: false }, readState: { seenAt: 3000, seenKeys: ["w-1"] } }
    });
    expect(res.json().user.notificationPrefs).toEqual({
      enabled: { ppe: false },
      readState: { seenAt: 3000, seenKeys: ["w-1"] }
    });

    const contactRes = await call(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: { phone: "050-1234567" }
    });
    expect(contactRes.statusCode).toBe(400);
    expect(contactRes.json()).toEqual({ error: "profile_contact_patch_requires_password_session" });
  });

  it("uses user bearer for identity and service role for updates", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify({ id: "auth-user-1", email: "owner@example.com" }); } })
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify([{ id: "app-user-1", auth_user_id: "auth-user-1", role: "admin", name: "Owner", active: true }]); } })
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify({ id: "auth-user-1", email: "owner2@example.com" }); } })
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify([{ id: "app-user-1", auth_user_id: "auth-user-1", phone: "050-1234567" }]); } });
    const client = createSupabaseProfileUpdateClient({
      url: "https://supabase.example/",
      anonKey: "anon-key",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await client.getAuthUser("user-token");
    await client.getAppUserProfile("user-token", "auth-user-1");
    await client.updateAuthEmail("auth-user-1", "owner2@example.com");
    await client.updateAppUserProfile("auth-user-1", { phone: "050-1234567" });

    expect(fetchImpl.mock.calls[0]).toEqual(["https://supabase.example/auth/v1/user", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({ apikey: "anon-key", authorization: "Bearer user-token" })
    })]);
    expect(fetchImpl.mock.calls[2]).toEqual(["https://supabase.example/auth/v1/admin/users/auth-user-1", expect.objectContaining({
      method: "PUT",
      headers: expect.objectContaining({ apikey: "service-key", authorization: "Bearer service-key" }),
      body: JSON.stringify({ email: "owner2@example.com", email_confirm: true })
    })]);
    expect(fetchImpl.mock.calls[3]).toEqual(["https://supabase.example/rest/v1/app_users?auth_user_id=eq.auth-user-1", expect.objectContaining({
      method: "PATCH",
      headers: expect.objectContaining({ apikey: "service-key", authorization: "Bearer service-key" })
    })]);
  });
});
