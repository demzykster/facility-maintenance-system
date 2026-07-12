import { describe, expect, it, vi } from "vitest";
import { createPresenceApiHandler } from "../server/presence/handler.js";

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
    getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "tech@example.com" }),
    getAppUserProfile: vi.fn().mockResolvedValue({
      id: "user-1",
      auth_user_id: "auth-user-1",
      role: "tech",
      name: "Tech",
      active: true,
      permissions: {},
      must_change_password: false,
      ...profile
    })
  };
}

describe("presence API handler", () => {
  it("lists presence for active roles", async () => {
    const driver = { list: vi.fn().mockResolvedValue([{ id: "user-1" }]), get: vi.fn() };
    const handler = createPresenceApiHandler({ driver, sessionClient: sessionClientFor({ role: "executive" }) });

    const res = await call(handler, { headers: { authorization: "Bearer token" }, query: { limit: "25" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, presence: [{ id: "user-1" }] });
    expect(driver.list).toHaveBeenCalledWith({ limit: "25" });
  });

  it("allows executives to upsert their own presence", async () => {
    const driver = { upsert: vi.fn().mockResolvedValue({ id: "user-1" }) };
    const handler = createPresenceApiHandler({ driver, sessionClient: sessionClientFor({ role: "executive" }) });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { presence: { id: "user-1", name: "Executive", lastSeen: 1783658300000 } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, presence: { id: "user-1", sourceKvKey: "presence:user-1" } });
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "user-1", name: "Executive" }));
  });

  it("allows users to upsert only their own presence", async () => {
    const driver = { upsert: vi.fn().mockResolvedValue({ id: "user-1" }) };
    const handler = createPresenceApiHandler({ driver, sessionClient: sessionClientFor({ role: "worker" }) });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { presence: { id: "user-1", name: "Worker", lastSeen: 1783658300000 } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, presence: { id: "user-1", sourceKvKey: "presence:user-1" } });
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "user-1", name: "Worker" }));
  });

  it("blocks users from writing another user's presence", async () => {
    const driver = { upsert: vi.fn() };
    const handler = createPresenceApiHandler({ driver, sessionClient: sessionClientFor({ role: "worker" }) });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { presence: { id: "user-2", name: "Other" } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:presence:self" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("allows admins to delete presence records", async () => {
    const driver = { delete: vi.fn().mockResolvedValue(undefined) };
    const handler = createPresenceApiHandler({ driver, sessionClient: sessionClientFor({ role: "admin" }) });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer token" },
      query: { id: "user-2" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, presence: { id: "user-2" } });
    expect(driver.delete).toHaveBeenCalledWith("user-2");
  });
});
