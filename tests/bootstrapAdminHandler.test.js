import { describe, expect, it, vi } from "vitest";
import {
  createBootstrapAdminHandler,
  createSupabaseAdminBootstrapClient,
  validateBootstrapAdminPayload
} from "../api/bootstrap/adminHandler.js";

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

  it("validates and normalizes the first admin payload", () => {
    expect(validateBootstrapAdminPayload({ email: "bad", temporaryPassword: "long-password" })).toEqual({
      ok: false,
      error: "valid_email_required"
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
    const handler = createBootstrapAdminHandler({
      env: { CMMS_BOOTSTRAP_ENABLED: "true", CMMS_BOOTSTRAP_TOKEN: "secret" },
      supabaseClient: { createAdmin }
    });

    const res = await call(handler, {
      headers: { "x-cmms-bootstrap-token": "secret" },
      body: { email: "ADMIN@Example.COM", name: "Owner", temporaryPassword: "long-password" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      admin: { id: "auth-user-1", email: "admin@example.com", role: "admin", mustChangePassword: true },
      disableBootstrapAfterSuccess: true
    });
    expect(JSON.stringify(res.json())).not.toContain("long-password");
    expect(createAdmin).toHaveBeenCalledWith(expect.objectContaining({
      email: "admin@example.com",
      temporaryPassword: "long-password",
      role: "admin",
      mustChangePassword: true
    }));
  });

  it("calls Supabase Auth Admin create-user endpoint with server-only credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({ id: "auth-user-1", email: "admin@example.com" });
      }
    });
    const client = createSupabaseAdminBootstrapClient({
      url: "https://supabase.example/",
      serviceRoleKey: "service-role-key",
      fetchImpl
    });

    const admin = await client.createAdmin({
      email: "admin@example.com",
      name: "Owner",
      role: "admin",
      temporaryPassword: "long-password",
      mustChangePassword: true
    });

    expect(admin).toEqual({ id: "auth-user-1", email: "admin@example.com", role: "admin", mustChangePassword: true });
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/auth/v1/admin/users", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service-role-key",
        authorization: "Bearer service-role-key"
      })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      email: "admin@example.com",
      email_confirm: true,
      user_metadata: { role: "admin", must_change_password: true },
      app_metadata: { role: "admin" }
    });
  });
});
