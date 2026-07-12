import { describe, expect, it, vi } from "vitest";
import { createCleaningZonesApiHandler } from "../server/cleaning/zonesHandler.js";
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

describe("cleaning zones API handler", () => {
  it("requires a Supabase or CMMS bearer token", async () => {
    const handler = createCleaningZonesApiHandler({ driver: { list: vi.fn() } });

    const res = await call(handler, {});

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "supabase_access_token_required" });
  });

  it("lists cleaning zones for legacy cleaner sessions", async () => {
    const driver = { list: vi.fn().mockResolvedValue([{ id: "zone-1", name: "Lobby" }]), get: vi.fn() };
    const handler = createCleaningZonesApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "cleaner" })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer cleaner-token" },
      query: { limit: "25" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, zones: [{ id: "zone-1", name: "Lobby" }] });
    expect(driver.list).toHaveBeenCalledWith({ limit: "25" });
  });

  it("lists cleaning zones for executive BI sessions", async () => {
    const driver = { list: vi.fn().mockResolvedValue([{ id: "zone-1", name: "Lobby" }]), get: vi.fn() };
    const handler = createCleaningZonesApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "executive" })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer executive-token" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, zones: [{ id: "zone-1", name: "Lobby" }] });
  });

  it("blocks workers without cleaning access from reading cleaning zones", async () => {
    const driver = { list: vi.fn(), get: vi.fn() };
    const token = signCmmsSessionToken("worker-1", "worker", "1042", "session-secret", Date.now()).token;
    const handler = createCleaningZonesApiHandler({
      driver,
      env: { CMMS_SESSION_SECRET: "session-secret" }
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:cleaning:view" });
    expect(driver.list).not.toHaveBeenCalled();
  });

  it("upserts cleaning zones for sessions allowed to manage settings", async () => {
    const driver = { upsert: vi.fn().mockResolvedValue({ id: "zone-1" }) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createCleaningZonesApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ permissions: { settings: "manage" } })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer manager-token" },
      body: { zone: { id: "zone-1", name: "Lobby", building: "A" } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, zone: { id: "zone-1", name: "Lobby", sourceKvKey: "czone:zone-1" } });
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "zone-1", name: "Lobby" }));
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "cleaning",
      entityId: "zone-1",
      action: "update"
    }));
  });

  it("blocks cleaning zone writes for sessions without settings management", async () => {
    const driver = { upsert: vi.fn() };
    const handler = createCleaningZonesApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { settings: "view" } })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer manager-token" },
      body: { zone: { id: "zone-1", name: "Lobby" } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:settings:manage" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("deletes cleaning zones for sessions allowed to manage settings", async () => {
    const driver = { delete: vi.fn().mockResolvedValue(undefined) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createCleaningZonesApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ permissions: { settings: "manage" } })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer manager-token" },
      query: { id: "zone-1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, zone: { id: "zone-1" } });
    expect(driver.delete).toHaveBeenCalledWith("zone-1");
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "cleaning",
      entityId: "zone-1",
      action: "delete"
    }));
  });
});
