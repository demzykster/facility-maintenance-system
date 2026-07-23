import { describe, expect, it, vi } from "vitest";
import {
  buildFirstRunAppUserProfile,
  createInstallHandler,
  createSupabaseInstallClient,
  validateFirstRunAdminPayload
} from "../server/install/handler.js";

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body = "") {
      this.body = body;
    },
    json() {
      return this.body ? JSON.parse(this.body) : null;
    }
  };
}

async function call(handler, req = {}) {
  const res = createRes();
  await handler({ headers: {}, method: "GET", body: {}, ...req }, res);
  return res;
}

const validBody = {
  name: "Owner",
  email: "OWNER@example.com",
  password: "long-password",
  confirmPassword: "long-password",
  role: "super_admin",
  permissions: { users: "manage" }
};

describe("first-run install handler", () => {
  it("validates only first-run admin identity fields and never trusts a client role", () => {
    expect(validateFirstRunAdminPayload({ email: "bad", password: "long-password", confirmPassword: "long-password" })).toEqual({
      ok: false,
      error: "valid_email_required"
    });
    expect(validateFirstRunAdminPayload({ email: "admin@example.com", password: "short", confirmPassword: "short" })).toEqual({
      ok: false,
      error: "password_min_8_chars"
    });
    expect(validateFirstRunAdminPayload({ email: "admin@example.com", password: "long-password", confirmPassword: "other-password" })).toEqual({
      ok: false,
      error: "password_confirmation_mismatch"
    });
    expect(validateFirstRunAdminPayload(validBody)).toMatchObject({
      ok: true,
      admin: {
        name: "Owner",
        email: "owner@example.com",
        password: "long-password",
        role: "admin",
        active: true
      }
    });
  });

  it("uses active admin presence as the readiness source of truth", async () => {
    const installClient = {
      hasExistingActiveAdmin: vi.fn().mockResolvedValue(true),
      getInstallLock: vi.fn()
    };
    const handler = createInstallHandler({ installClient });

    const res = await call(handler, { method: "GET" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.json()).toEqual({ ok: true, state: "ready" });
    expect(installClient.getInstallLock).not.toHaveBeenCalled();
  });

  it("reports a new installable system when no active admin and no install lock exist", async () => {
    const installClient = {
      hasExistingActiveAdmin: vi.fn().mockResolvedValue(false),
      getInstallLock: vi.fn().mockResolvedValue(null)
    };
    const handler = createInstallHandler({ installClient });

    const res = await call(handler, { method: "GET" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, state: "new" });
  });

  it("blocks install when a previous partial install needs manual recovery", async () => {
    const installClient = {
      hasExistingActiveAdmin: vi.fn().mockResolvedValue(false),
      getInstallLock: vi.fn().mockResolvedValue({ config: { status: "failed" } })
    };
    const handler = createInstallHandler({ installClient });

    const res = await call(handler, { method: "GET" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, state: "blocked", reason: "install_recovery_required" });
  });

  it("refuses to create a first admin after the system is already initialized", async () => {
    const installClient = {
      hasExistingActiveAdmin: vi.fn().mockResolvedValue(true),
      acquireInstallLock: vi.fn(),
      createAuthAdmin: vi.fn(),
      createAppUserProfile: vi.fn()
    };
    const handler = createInstallHandler({ installClient });

    const res = await call(handler, { method: "POST", body: validBody });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "system_already_initialized" });
    expect(installClient.acquireInstallLock).not.toHaveBeenCalled();
    expect(installClient.createAuthAdmin).not.toHaveBeenCalled();
  });

  it("creates the first active ordinary admin and writes an audit event without exposing the password", async () => {
    const installClient = {
      hasExistingActiveAdmin: vi.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false),
      acquireInstallLock: vi.fn().mockResolvedValue({ id: "install:first-admin" }),
      createAuthAdmin: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "owner@example.com", role: "admin" }),
      createAppUserProfile: vi.fn().mockResolvedValue({ id: "app-user-1", authUserId: "auth-user-1", email: "owner@example.com", role: "admin", active: true }),
      markInstallLock: vi.fn().mockResolvedValue()
    };
    const auditDriver = { write: vi.fn().mockResolvedValue() };
    const handler = createInstallHandler({ installClient, auditDriver });

    const res = await call(handler, { method: "POST", body: validBody });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      ok: true,
      state: "ready",
      admin: {
        id: "app-user-1",
        email: "owner@example.com",
        role: "admin",
        active: true
      }
    });
    expect(JSON.stringify(res.json())).not.toContain("long-password");
    expect(installClient.createAuthAdmin).toHaveBeenCalledWith(expect.objectContaining({
      email: "owner@example.com",
      role: "admin",
      active: true
    }));
    expect(installClient.createAuthAdmin.mock.calls[0][0]).not.toHaveProperty("permissions");
    expect(installClient.createAppUserProfile).toHaveBeenCalledWith(expect.objectContaining({
      email: "owner@example.com",
      role: "admin"
    }), expect.objectContaining({ id: "auth-user-1" }));
    expect(installClient.markInstallLock).toHaveBeenCalledWith("ready");
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "user",
      action: "bootstrap",
      actorRole: "system",
      after: expect.objectContaining({ email: "owner@example.com", role: "admin", active: true })
    }));
  });

  it("uses a database lock before auth creation and rejects concurrent install attempts", async () => {
    const installClient = {
      hasExistingActiveAdmin: vi.fn().mockResolvedValue(false),
      acquireInstallLock: vi.fn().mockRejectedValue(new Error("install_lock_exists")),
      createAuthAdmin: vi.fn(),
      createAppUserProfile: vi.fn()
    };
    const handler = createInstallHandler({ installClient });

    const res = await call(handler, { method: "POST", body: validBody });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "system_install_in_progress" });
    expect(installClient.createAuthAdmin).not.toHaveBeenCalled();
    expect(installClient.createAppUserProfile).not.toHaveBeenCalled();
  });

  it("marks a partial app_users failure without claiming success or returning raw internals", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const installClient = {
      hasExistingActiveAdmin: vi.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false),
      acquireInstallLock: vi.fn().mockResolvedValue({ id: "install:first-admin" }),
      createAuthAdmin: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "owner@example.com", role: "admin" }),
      createAppUserProfile: vi.fn().mockRejectedValue(new Error("profile insert stack secret long-password")),
      markInstallLock: vi.fn().mockResolvedValue()
    };
    const handler = createInstallHandler({ installClient });

    try {
      const res = await call(handler, {
        method: "POST",
        headers: { "x-request-id": "install-req-1" },
        body: validBody
      });

      expect(res.statusCode).toBe(500);
      expect(res.headers["x-cmms-request-id"]).toBe("install-req-1");
      expect(res.json()).toEqual({ error: "install_profile_error", requestId: "install-req-1" });
      expect(JSON.stringify(res.json())).not.toContain("auth-user-1");
      expect(JSON.stringify(res.json())).not.toContain("long-password");
      expect(installClient.markInstallLock).toHaveBeenCalledWith("failed", { phase: "app_users", authUserCreated: true });
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("supports HEAD and rejects unsupported methods", async () => {
    const installClient = { hasExistingActiveAdmin: vi.fn().mockResolvedValue(true) };
    const handler = createInstallHandler({ installClient });

    const head = await call(handler, { method: "HEAD" });
    const put = await call(handler, { method: "PUT" });

    expect(head.statusCode).toBe(200);
    expect(head.body).toBe("");
    expect(put.statusCode).toBe(405);
    expect(put.headers.allow).toBe("GET, HEAD, POST");
  });

  it("builds the app user profile without a hidden owner or superuser flag", () => {
    expect(buildFirstRunAppUserProfile({ name: "Owner", email: "owner@example.com" }, { id: "auth-user-1" })).toEqual({
      auth_user_id: "auth-user-1",
      role: "admin",
      name: "Owner",
      email: "owner@example.com",
      active: true,
      permissions: {},
      login_state: "active",
      login_metadata: {
        source: "first-run-install",
        first_run: true
      },
      must_change_password: false
    });
  });

  it("uses service-role REST calls without returning secrets from the Supabase client", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify([]); } })
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify([]); } })
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify([{ id: "install:first-admin", config: { status: "pending" } }]); } })
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify({ id: "auth-user-1", email: "owner@example.com" }); } })
      .mockResolvedValueOnce({ ok: true, async text() { return JSON.stringify([{ id: "app-user-1", auth_user_id: "auth-user-1", email: "owner@example.com", role: "admin", active: true }]); } })
      .mockResolvedValueOnce({ ok: true, async text() { return ""; } });
    const client = createSupabaseInstallClient({
      url: "https://supabase.example/",
      serviceRoleKey: "service-role-key",
      fetchImpl
    });

    await expect(client.hasExistingActiveAdmin()).resolves.toBe(false);
    await expect(client.getInstallLock()).resolves.toBeNull();
    await expect(client.acquireInstallLock()).resolves.toMatchObject({ id: "install:first-admin" });
    const authUser = await client.createAuthAdmin({ name: "Owner", email: "owner@example.com", password: "long-password" });
    await expect(client.createAppUserProfile({ name: "Owner", email: "owner@example.com" }, authUser)).resolves.toMatchObject({
      id: "app-user-1",
      role: "admin",
      active: true
    });
    await expect(client.markInstallLock("ready")).resolves.toBeUndefined();

    expect(fetchImpl.mock.calls[2][0]).toBe("https://supabase.example/rest/v1/app_config");
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toMatchObject({
      id: "install:first-admin",
      config: { source: "first-run-install", status: "pending" }
    });
    expect(fetchImpl.mock.calls[3][0]).toBe("https://supabase.example/auth/v1/admin/users");
    expect(JSON.parse(fetchImpl.mock.calls[3][1].body)).toMatchObject({
      email: "owner@example.com",
      email_confirm: true,
      app_metadata: { role: "admin" }
    });
    expect(fetchImpl.mock.calls[4][0]).toBe("https://supabase.example/rest/v1/app_users");
    expect(JSON.parse(fetchImpl.mock.calls[4][1].body)).toMatchObject({
      auth_user_id: "auth-user-1",
      role: "admin",
      active: true,
      permissions: {},
      login_metadata: { source: "first-run-install" }
    });
  });
});
