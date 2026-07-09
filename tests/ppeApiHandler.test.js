import { describe, expect, it, vi } from "vitest";
import { createPpeApiHandler } from "../server/ppe/handler.js";

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

describe("PPE API handler", () => {
  it("requires a resource", async () => {
    const handler = createPpeApiHandler({
      drivers: { items: { list: vi.fn() } },
      sessionClient: sessionClientFor({ role: "admin" })
    });

    const res = await call(handler, { headers: { authorization: "Bearer token" } });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "ppe_resource_required" });
  });

  it("lists PPE items for request-level users", async () => {
    const items = { list: vi.fn().mockResolvedValue([{ id: "item-1", name: "Vest" }]), get: vi.fn() };
    const handler = createPpeApiHandler({
      drivers: { items },
      sessionClient: sessionClientFor({ role: "user", permissions: { ppe: "request" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer token" },
      query: { resource: "items", limit: "25" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, items: [{ id: "item-1", name: "Vest" }] });
    expect(items.list).toHaveBeenCalledWith({ limit: "25" });
  });

  it("allows request-level users to create PPE requests", async () => {
    const requests = { upsert: vi.fn().mockResolvedValue({ id: "req-1" }) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createPpeApiHandler({
      drivers: { requests },
      auditDriver,
      sessionClient: sessionClientFor({ role: "user", permissions: { ppe: "request" } })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { resource: "requests", request: { id: "req-1", workerName: "Worker", lines: [] } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, request: { id: "req-1", sourceKvKey: "ppereq:req-1" } });
    expect(requests.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "req-1", workerName: "Worker" }));
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "ppe",
      entityId: "req-1",
      action: "update"
    }));
  });

  it("blocks request-level users from managing PPE items", async () => {
    const items = { upsert: vi.fn() };
    const handler = createPpeApiHandler({
      drivers: { items },
      sessionClient: sessionClientFor({ role: "user", permissions: { ppe: "request" } })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { resource: "items", item: { id: "item-1", name: "Vest" } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:ppe:manage" });
    expect(items.upsert).not.toHaveBeenCalled();
  });

  it("allows PPE managers to delete orders", async () => {
    const orders = { delete: vi.fn().mockResolvedValue(undefined) };
    const handler = createPpeApiHandler({
      drivers: { orders },
      sessionClient: sessionClientFor({ role: "user", permissions: { ppe: "manage" } })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer token" },
      query: { resource: "orders", id: "order-1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, order: { id: "order-1" } });
    expect(orders.delete).toHaveBeenCalledWith("order-1");
  });

  it("returns id validation errors for malformed resources", async () => {
    const handler = createPpeApiHandler({
      drivers: { movements: { upsert: vi.fn() } },
      sessionClient: sessionClientFor({ role: "admin" })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { resource: "movements", movement: { workerName: "Worker" } }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "ppe_movement_id_required" });
  });
});
