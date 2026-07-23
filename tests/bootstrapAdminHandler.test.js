import { describe, expect, it, vi } from "vitest";
import {
  buildBootstrapAppUserProfile,
  createBootstrapAdminHandler,
  createSupabaseAdminBootstrapClient,
  validateBootstrapAdminPayload
} from "../server/bootstrap/adminHandler.js";

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

describe("bootstrap admin handler", () => {
  it("is closed unless bootstrap mode is explicitly enabled", async () => {
    const handler = createBootstrapAdminHandler({ env: {} });

    const res = await call(handler, { body: { email: "admin@example.com", temporaryPassword: "long-password" } });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "bootstrap_disabled" });
  });

  it("requires a server bootstrap token after bootstrap is enabled", async () => {
    const handler = createBootstrapAdminHandler({ env: { CMMS_BOOTSTRAP_ENABLED: "true", CMMS_BOOTSTRAP_TOKEN: "secret" } });

    const res = await call(handler, {
      headers: { authorization: "Bearer wrong" },
      body: { email: "admin@example.com", temporaryPassword: "long-password" }
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "bootstrap_unauthorized" });
  });

  it("does not claim Supabase bootstrap works before server env is configured", async () => {
    const handler = createBootstrapAdminHandler({ env: { CMMS_BOOTSTRAP_ENABLED: "true", CMMS_BOOTSTRAP_TOKEN: "secret" } });

    const res = await call(handler, {
      headers: { authorization: "Bearer secret" },
      body: { email: "admin@example.com", temporaryPassword: "long-password" }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "supabase_admin_not_configured" });
  });

  it("fails before creating auth when bootstrap audit is not configured", async () => {
    const createAdmin = vi.fn();
    const createAppUserProfile = vi.fn();
    const hasExistingActiveAdmin = vi.fn().mockResolvedValue(false);
    const handler = createBootstrapAdminHandler({
      env: { CMMS_BOOTSTRAP_ENABLED: "true", CMMS_BOOTSTRAP_TOKEN: "secret" },
      supabaseClient: { createAdmin, createAppUserProfile, hasExistingActiveAdmin }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer secret" },
      body: { email: "admin@example.com", temporaryPassword: "long-password" }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "bootstrap_audit_not_configured" });
    expect(createAdmin).not.toHaveBeenCalled();
    expect(createAppUserProfile).not.toHaveBeenCalled();
  });

  it("fails before creating auth when bootstrap install marker writer is not configured", async () => {
    const createAdmin = vi.fn();
    const createAppUserProfile = vi.fn();
    const hasExistingActiveAdmin = vi.fn().mockResolvedValue(false);
    const auditDriver = { write: vi.fn() };
    const handler = createBootstrapAdminHandler({
      env: { CMMS_BOOTSTRAP_ENABLED: "true", CMMS_BOOTSTRAP_TOKEN: "secret" },
      supabaseClient: { createAdmin, createAppUserProfile, hasExistingActiveAdmin },
      auditDriver
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer secret" },
      body: { email: "admin@example.com", temporaryPassword: "long-password" }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "bootstrap_install_marker_not_configured" });
    expect(createAdmin).not.toHaveBeenCalled();
    expect(createAppUserProfile).not.toHaveBeenCalled();
    expect(auditDriver.write).not.toHaveBeenCalled();
  });

  it("validates and normalizes the first admin payload", () => {
    expect(validateBootstrapAdminPayload({ email: "bad", temporaryPassword: "long-password" })).toEqual({
      ok: false,
      error: "valid_email_required"
    });
    expect(validateBootstrapAdminPayload({ email: "admin@example.com", temporaryPassword: "short" })).toEqual({
      ok: false,
      error: "temporary_password_min_6_chars"
    });
    expect(validateBootstrapAdminPayload({ email: "ADMIN@Example.COM", temporaryPassword: "simple" })).toMatchObject({
      ok: true,
      admin: { email: "admin@example.com", temporaryPassword: "simple" }
    });
    expect(validateBootstrapAdminPayload({ email: "ADMIN@Example.COM", temporaryPassword: "long-password" })).toMatchObject({
      ok: true,
      admin: {
        email: "admin@example.com",
        name: "מנהל מערכת",
        role: "admin",
        active: true,
        mustChangePassword: true,
        bootstrap: true
      }
    });
  });

  it("creates the admin through the injected server client without returning the password", async () => {
    const createAdmin = vi.fn().mockResolvedValue({ id: "auth-user-1", email: "admin@example.com", role: "admin", mustChangePassword: true });
    const createAppUserProfile = vi.fn().mockResolvedValue({
      id: "app-user-1",
      authUserId: "auth-user-1",
      email: "admin@example.com",
      role: "admin",
      active: true,
      mustChangePassword: true
    });
    const auditDriver = { write: vi.fn().mockResolvedValue() };
    const setPermanentInstallMarker = vi.fn().mockResolvedValue();
    const handler = createBootstrapAdminHandler({
      env: { CMMS_BOOTSTRAP_ENABLED: "true", CMMS_BOOTSTRAP_TOKEN: "secret" },
      supabaseClient: { createAdmin, createAppUserProfile, setPermanentInstallMarker },
      auditDriver
    });

    const res = await call(handler, {
      headers: { "x-cmms-bootstrap-token": "secret" },
      body: { email: "ADMIN@Example.COM", name: "Owner", temporaryPassword: "long-password" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      admin: { id: "auth-user-1", email: "admin@example.com", role: "admin", mustChangePassword: true },
      appUser: {
        id: "app-user-1",
        authUserId: "auth-user-1",
        email: "admin@example.com",
        role: "admin",
        active: true,
        mustChangePassword: true
      },
      disableBootstrapAfterSuccess: true
    });
    expect(JSON.stringify(res.json())).not.toContain("long-password");
    expect(createAdmin).toHaveBeenCalledWith(expect.objectContaining({
      email: "admin@example.com",
      temporaryPassword: "long-password",
      role: "admin",
      mustChangePassword: true
    }));
    expect(createAppUserProfile).toHaveBeenCalledWith(expect.objectContaining({
      email: "admin@example.com",
      role: "admin",
      mustChangePassword: true
    }), expect.objectContaining({ id: "auth-user-1" }));
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "user",
      action: "bootstrap"
    }));
    expect(setPermanentInstallMarker).toHaveBeenCalledWith(expect.objectContaining({
      source: "bootstrap",
      appUserId: "app-user-1"
    }));
  });

  it("does not report bootstrap success if the app profile insert fails after auth creation", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const createAdmin = vi.fn().mockResolvedValue({ id: "auth-user-1", email: "admin@example.com", role: "admin", mustChangePassword: true });
    const createAppUserProfile = vi.fn().mockRejectedValue(new Error("profile_insert_failed"));
    const handler = createBootstrapAdminHandler({
      env: { CMMS_BOOTSTRAP_ENABLED: "true", CMMS_BOOTSTRAP_TOKEN: "secret" },
      supabaseClient: { createAdmin, createAppUserProfile, setPermanentInstallMarker: vi.fn() },
      auditDriver: { write: vi.fn().mockResolvedValue() }
    });

    try {
      const res = await call(handler, {
        headers: { authorization: "Bearer secret", "x-request-id": "bootstrap-req-1" },
        body: { email: "admin@example.com", name: "Owner", temporaryPassword: "long-password" }
      });

      expect(res.statusCode).toBe(500);
      expect(res.headers["x-cmms-request-id"]).toBe("bootstrap-req-1");
      expect(res.json()).toEqual({
        error: "bootstrap_profile_error",
        requestId: "bootstrap-req-1",
        authUserCreated: true,
        authUserId: "auth-user-1"
      });
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(JSON.parse(consoleError.mock.calls[0][0])).toMatchObject({
        requestId: "bootstrap-req-1",
        route: "/api/bootstrap/admin",
        code: "bootstrap_profile_error",
        message: "profile_insert_failed"
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it("refuses bootstrap when an active admin profile already exists", async () => {
    const createAdmin = vi.fn();
    const createAppUserProfile = vi.fn();
    const hasExistingActiveAdmin = vi.fn().mockResolvedValue(true);
    const handler = createBootstrapAdminHandler({
      env: { CMMS_BOOTSTRAP_ENABLED: "true", CMMS_BOOTSTRAP_TOKEN: "secret" },
      supabaseClient: { createAdmin, createAppUserProfile, hasExistingActiveAdmin }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer secret" },
      body: { email: "admin@example.com", name: "Owner", temporaryPassword: "long-password" }
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "bootstrap_admin_already_exists" });
    expect(hasExistingActiveAdmin).toHaveBeenCalledTimes(1);
    expect(createAdmin).not.toHaveBeenCalled();
    expect(createAppUserProfile).not.toHaveBeenCalled();
  });

  it("blocks bootstrap recovery for an initialized system unless recovery mode is explicitly enabled", async () => {
    const createAdmin = vi.fn();
    const createAppUserProfile = vi.fn();
    const hasExistingActiveAdmin = vi.fn().mockResolvedValue(false);
    const getPermanentInstallMarker = vi.fn().mockResolvedValue({ config: { status: "completed" } });
    const handler = createBootstrapAdminHandler({
      env: { CMMS_BOOTSTRAP_ENABLED: "true", CMMS_BOOTSTRAP_TOKEN: "secret" },
      supabaseClient: { createAdmin, createAppUserProfile, hasExistingActiveAdmin, getPermanentInstallMarker }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer secret" },
      body: { email: "admin@example.com", name: "Owner", temporaryPassword: "long-password" }
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "admin_recovery_requires_explicit_bootstrap" });
    expect(createAdmin).not.toHaveBeenCalled();
    expect(createAppUserProfile).not.toHaveBeenCalled();
  });

  it("allows env-gated admin recovery bootstrap and records audit plus install marker", async () => {
    const createAdmin = vi.fn().mockResolvedValue({ id: "auth-user-1", email: "admin@example.com", role: "admin", mustChangePassword: true });
    const createAppUserProfile = vi.fn().mockResolvedValue({
      id: "app-user-1",
      authUserId: "auth-user-1",
      email: "admin@example.com",
      role: "admin",
      active: true,
      mustChangePassword: true
    });
    const hasExistingActiveAdmin = vi.fn().mockResolvedValue(false);
    const getPermanentInstallMarker = vi.fn().mockResolvedValue({ config: { status: "completed" } });
    const setPermanentInstallMarker = vi.fn().mockResolvedValue();
    const auditDriver = { write: vi.fn().mockResolvedValue() };
    const handler = createBootstrapAdminHandler({
      env: {
        CMMS_BOOTSTRAP_ENABLED: "true",
        CMMS_BOOTSTRAP_TOKEN: "secret",
        CMMS_BOOTSTRAP_ALLOW_ADMIN_RECOVERY: "true"
      },
      supabaseClient: {
        createAdmin,
        createAppUserProfile,
        hasExistingActiveAdmin,
        getPermanentInstallMarker,
        setPermanentInstallMarker
      },
      auditDriver
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer secret" },
      body: { email: "admin@example.com", name: "Owner", temporaryPassword: "long-password" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, disableBootstrapAfterSuccess: true });
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "user",
      action: "bootstrap",
      actorName: "admin-recovery-bootstrap"
    }));
    expect(setPermanentInstallMarker).toHaveBeenCalledWith(expect.objectContaining({
      source: "bootstrap",
      recovery: true,
      appUserId: "app-user-1"
    }));
  });

  it("builds the app user profile row from the auth user", () => {
    expect(buildBootstrapAppUserProfile({
      email: "admin@example.com",
      name: "Owner"
    }, {
      id: "auth-user-1"
    })).toEqual({
      auth_user_id: "auth-user-1",
      role: "admin",
      name: "Owner",
      email: "admin@example.com",
      active: true,
      permissions: {},
      login_metadata: {
        source: "bootstrap",
        bootstrap: true
      },
      must_change_password: true
    });
  });

  it("calls Supabase Auth Admin and app_users REST endpoints with server-only credentials", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        async text() {
          return JSON.stringify([]);
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        async text() {
          return JSON.stringify({ id: "auth-user-1", email: "admin@example.com" });
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        async text() {
          return JSON.stringify([{ id: "app-user-1", auth_user_id: "auth-user-1", email: "admin@example.com", role: "admin", active: true, must_change_password: true }]);
        }
      });
    const client = createSupabaseAdminBootstrapClient({
      url: "https://supabase.example/",
      serviceRoleKey: "service-role-key",
      fetchImpl
    });

    await expect(client.hasExistingActiveAdmin()).resolves.toBe(false);
    const admin = await client.createAdmin({
      email: "admin@example.com",
      name: "Owner",
      role: "admin",
      temporaryPassword: "long-password",
      mustChangePassword: true
    });
    const appUser = await client.createAppUserProfile({
      email: "admin@example.com",
      name: "Owner",
      role: "admin",
      temporaryPassword: "long-password",
      mustChangePassword: true
    }, admin);

    expect(admin).toEqual({ id: "auth-user-1", email: "admin@example.com", role: "admin", mustChangePassword: true });
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/app_users?role=eq.admin&active=is.true&select=id&limit=1", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({
        apikey: "service-role-key",
        authorization: "Bearer service-role-key"
      })
    }));
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/auth/v1/admin/users", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service-role-key",
        authorization: "Bearer service-role-key"
      })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toMatchObject({
      email: "admin@example.com",
      email_confirm: true,
      user_metadata: { role: "admin", must_change_password: true },
      app_metadata: { role: "admin" }
    });
    expect(appUser).toEqual({
      id: "app-user-1",
      authUserId: "auth-user-1",
      email: "admin@example.com",
      role: "admin",
      active: true,
      mustChangePassword: true
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/app_users", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service-role-key",
        authorization: "Bearer service-role-key",
        prefer: "return=representation"
      })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toMatchObject({
      auth_user_id: "auth-user-1",
      email: "admin@example.com",
      role: "admin",
      active: true,
      permissions: {},
      login_metadata: { source: "bootstrap" },
      must_change_password: true
    });
  });
});
