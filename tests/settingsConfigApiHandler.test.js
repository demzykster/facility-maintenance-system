import { describe, expect, it, vi } from "vitest";
import { createSettingsConfigApiHandler } from "../server/settings/configHandler.js";

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
  await handler({ headers: {}, query: {}, method: "GET", ...req }, res);
  return res;
}

function sessionClientFor(profile = {}) {
  return {
    getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "manager@example.com" }),
    getAppUserProfile: vi.fn().mockResolvedValue({
      id: "app-user-1",
      auth_user_id: "auth-user-1",
      role: "user",
      name: "Manager",
      active: true,
      permissions: {},
      must_change_password: false,
      ...profile
    })
  };
}

describe("settings config API handler", () => {
  it("reads normalized config for settings viewers", async () => {
    const configDriver = { get: vi.fn().mockResolvedValue({ config: { companyName: "CDSL" } }) };
    const handler = createSettingsConfigApiHandler({
      configDriver,
      mirrorDriver: null,
      sessionClient: sessionClientFor({ role: "user", permissions: { settings: "view" } })
    });

    const res = await call(handler, { headers: { authorization: "Bearer token" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, value: "{\"companyName\":\"CDSL\"}", config: { companyName: "CDSL" }, source: "normalized" });
  });

  it("falls back to config:v1 mirror when normalized row is missing", async () => {
    const configDriver = { get: vi.fn().mockResolvedValue(null) };
    const mirrorDriver = { get: vi.fn().mockResolvedValue("{\"companyName\":\"Legacy\"}") };
    const handler = createSettingsConfigApiHandler({
      configDriver,
      mirrorDriver,
      sessionClient: sessionClientFor({ role: "admin" })
    });

    const res = await call(handler, { headers: { authorization: "Bearer token" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, value: "{\"companyName\":\"Legacy\"}", config: { companyName: "Legacy" }, source: "kv" });
    expect(mirrorDriver.get).toHaveBeenCalledWith("config:v1", true);
  });

  it("writes normalized config and mirrors config:v1", async () => {
    const configDriver = { upsert: vi.fn().mockResolvedValue({ config: { departments: ["Ops"] } }) };
    const mirrorDriver = { set: vi.fn().mockResolvedValue(undefined) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createSettingsConfigApiHandler({
      configDriver,
      mirrorDriver,
      auditDriver,
      sessionClient: sessionClientFor({ role: "user", permissions: { settings: "manage" } })
    });

    const res = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer token" },
      body: { value: "{\"departments\":[\"Ops\"]}" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, config: { departments: ["Ops"] }, source: "normalized" });
    expect(configDriver.upsert).toHaveBeenCalledWith({ departments: ["Ops"] }, "main");
    expect(mirrorDriver.set).toHaveBeenCalledWith("config:v1", "{\"departments\":[\"Ops\"]}", true);
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "settings",
      entityId: "config:v1"
    }));
  });

  it("returns SLA sync counts after SLA settings change", async () => {
    const configDriver = {
      get: vi.fn().mockResolvedValue({ config: { catSla: { hvac: { high: 4 } } } }),
      upsert: vi.fn().mockResolvedValue({ config: { catSla: { hvac: { high: 6 } } } })
    };
    const ticketDriver = {
      list: vi.fn().mockResolvedValue([
        { id: "ticket-1", status: "new", track: "facility", category: "hvac", priority: "high", createdAt: 1_000, dueAt: 1_000 + 4 * 3600000 }
      ]),
      upsert: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createSettingsConfigApiHandler({
      configDriver,
      mirrorDriver: null,
      ticketDriver,
      fleetDriver: { list: vi.fn().mockResolvedValue([]) },
      sessionClient: sessionClientFor({ role: "user", permissions: { settings: "manage" } })
    });

    const res = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer token" },
      body: { config: { catSla: { hvac: { high: 6 } } } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().slaSync).toMatchObject({ checked: 1, updated: 1, skipped: 0, ambiguous: 0, failed: 0, policyChanged: true });
    expect(ticketDriver.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "ticket-1",
      dueAt: 1_000 + 6 * 3600000
    }));
  });

  it("does not update tickets when non-SLA settings change", async () => {
    const configDriver = {
      get: vi.fn().mockResolvedValue({ config: { companyName: "A", catSla: { hvac: { high: 4 } } } }),
      upsert: vi.fn().mockResolvedValue({ config: { companyName: "B", catSla: { hvac: { high: 4 } } } })
    };
    const ticketDriver = {
      list: vi.fn().mockResolvedValue([{ id: "ticket-1", status: "new", createdAt: 1_000, dueAt: null }]),
      upsert: vi.fn()
    };
    const handler = createSettingsConfigApiHandler({
      configDriver,
      mirrorDriver: null,
      ticketDriver,
      fleetDriver: { list: vi.fn().mockResolvedValue([]) },
      sessionClient: sessionClientFor({ role: "user", permissions: { settings: "manage" } })
    });

    const res = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer token" },
      body: { config: { companyName: "B", catSla: { hvac: { high: 4 } } } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().slaSync).toMatchObject({ checked: 0, updated: 0, policyChanged: false });
    expect(ticketDriver.list).not.toHaveBeenCalled();
    expect(ticketDriver.upsert).not.toHaveBeenCalled();
  });

  it("writes normalized config without recreating the retired production API mirror", async () => {
    const configDriver = { upsert: vi.fn().mockResolvedValue({ config: { departments: ["Ops"] } }) };
    const mirrorDriver = { set: vi.fn().mockResolvedValue(undefined) };
    const handler = createSettingsConfigApiHandler({
      configDriver,
      mirrorDriver,
      env: {
        VITE_CMMS_APP_MODE: "production",
        VITE_CMMS_STORAGE_PROVIDER: "api"
      },
      sessionClient: sessionClientFor({ role: "user", permissions: { settings: "manage" } })
    });

    const res = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer token" },
      body: { config: { departments: ["Ops"] } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, config: { departments: ["Ops"] }, source: "normalized" });
    expect(configDriver.upsert).toHaveBeenCalledWith({ departments: ["Ops"] }, "main");
    expect(mirrorDriver.set).not.toHaveBeenCalled();
  });

  it("requires settings management to write config", async () => {
    const configDriver = { upsert: vi.fn() };
    const handler = createSettingsConfigApiHandler({
      configDriver,
      sessionClient: sessionClientFor({ role: "user", permissions: { settings: "view" } })
    });

    const res = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer token" },
      body: { config: { companyName: "Nope" } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:settings:manage" });
    expect(configDriver.upsert).not.toHaveBeenCalled();
  });
});
