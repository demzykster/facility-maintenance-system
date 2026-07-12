import { describe, expect, it, vi } from "vitest";
import { createPmApiHandler } from "../server/pm/handler.js";
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
  await handler({ headers: {}, query: {}, method: "POST", ...req }, res);
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

describe("PM API handler", () => {
  it("requires a Supabase or CMMS bearer token", async () => {
    const handler = createPmApiHandler({ driver: { upsert: vi.fn() } });

    const res = await call(handler, { body: { id: "pm-1" } });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "supabase_access_token_required" });
  });

  it("does not claim PM operations work before the backend is configured", async () => {
    const handler = createPmApiHandler({ sessionClient: sessionClientFor() });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "pm-1" }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "pm_backend_not_configured" });
  });

  it("lists normalized PM tasks for active operational roles", async () => {
    const driver = { list: vi.fn().mockResolvedValue([{ id: "pm-1", title: "TO" }]), get: vi.fn() };
    const handler = createPmApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "tech" })
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: "Bearer tech-token" },
      query: { limit: "25" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tasks: [{ id: "pm-1", title: "TO" }] });
    expect(driver.list).toHaveBeenCalledWith({ limit: "25" });
  });

  it("lists normalized PM tasks for executive BI sessions", async () => {
    const driver = { list: vi.fn().mockResolvedValue([{ id: "pm-1", title: "TO" }]), get: vi.fn() };
    const handler = createPmApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "executive" })
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: "Bearer executive-token" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tasks: [{ id: "pm-1", title: "TO" }] });
  });

  it("blocks worker sessions from reading normalized PM tasks", async () => {
    const driver = { list: vi.fn(), get: vi.fn() };
    const token = signCmmsSessionToken("worker-1", "worker", "1042", "session-secret", Date.now()).token;
    const handler = createPmApiHandler({
      driver,
      env: { CMMS_SESSION_SECRET: "session-secret" }
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:pm:view" });
    expect(driver.list).not.toHaveBeenCalled();
  });

  it("upserts a normalized PM task and writes an audit event for allowed sessions", async () => {
    const driver = { upsert: vi.fn().mockResolvedValue({ id: "pm-1" }) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createPmApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ permissions: { settings: "manage" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "pm-1", forkliftId: "fleet-1", title: "TO 500" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, task: { id: "pm-1", sourceKvKey: "pm:pm-1" } });
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "pm-1", title: "TO 500" }));
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "fleet",
      entityId: "pm-1",
      action: "update"
    }));
  });

  it("blocks sessions that cannot manage fleet settings from writing", async () => {
    const driver = { upsert: vi.fn() };
    const handler = createPmApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { settings: "view" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "pm-2", title: "TO 1000" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:settings:manage" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("deletes normalized PM tasks for sessions allowed to manage fleet settings", async () => {
    const driver = { delete: vi.fn().mockResolvedValue(undefined) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createPmApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ permissions: { settings: "manage" } })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { id: "pm-3" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, task: { id: "pm-3" } });
    expect(driver.delete).toHaveBeenCalledWith("pm-3");
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "fleet",
      entityId: "pm-3",
      action: "delete"
    }));
  });
});
