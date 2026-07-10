import { describe, expect, it, vi } from "vitest";
import { createWorkApiHandler } from "../server/work/handler.js";

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

describe("work API handler", () => {
  it("requires a resource", async () => {
    const handler = createWorkApiHandler({
      drivers: { tasks: { list: vi.fn() } },
      sessionClient: sessionClientFor({ role: "admin" })
    });

    const res = await call(handler, { headers: { authorization: "Bearer token" } });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "work_resource_required" });
  });

  it("lists tasks for active roles", async () => {
    const tasks = { list: vi.fn().mockResolvedValue([{ id: "task-1", title: "Inspect" }]), get: vi.fn() };
    const handler = createWorkApiHandler({
      drivers: { tasks },
      sessionClient: sessionClientFor({ role: "tech" })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer token" },
      query: { resource: "tasks", limit: "25" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tasks: [{ id: "task-1", title: "Inspect" }] });
    expect(tasks.list).toHaveBeenCalledWith({ limit: "25" });
  });

  it("allows user roles to create tasks", async () => {
    const tasks = { upsert: vi.fn().mockResolvedValue({ id: "task-1" }) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createWorkApiHandler({
      drivers: { tasks },
      auditDriver,
      sessionClient: sessionClientFor({ role: "user" })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { resource: "tasks", task: { id: "task-1", title: "Inspect" } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, task: { id: "task-1", sourceKvKey: "mtask:task-1" } });
    expect(tasks.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1", title: "Inspect" }));
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "task",
      entityId: "task-1",
      action: "update"
    }));
  });

  it("blocks technicians from creating meetings", async () => {
    const meetings = { upsert: vi.fn() };
    const handler = createWorkApiHandler({
      drivers: { meetings },
      sessionClient: sessionClientFor({ role: "tech" })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { resource: "meetings", meeting: { id: "meet-1", title: "Weekly" } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:role:admin|user" });
    expect(meetings.upsert).not.toHaveBeenCalled();
  });

  it("allows admins to delete meetings", async () => {
    const meetings = { delete: vi.fn().mockResolvedValue(undefined) };
    const handler = createWorkApiHandler({
      drivers: { meetings },
      sessionClient: sessionClientFor({ role: "admin" })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer token" },
      query: { resource: "meetings", id: "meet-1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, meeting: { id: "meet-1" } });
    expect(meetings.delete).toHaveBeenCalledWith("meet-1");
  });

  it("returns id validation errors for malformed resources", async () => {
    const handler = createWorkApiHandler({
      drivers: { tasks: { upsert: vi.fn() } },
      sessionClient: sessionClientFor({ role: "admin" })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { resource: "tasks", task: { title: "Inspect" } }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "maintenance_task_id_required" });
  });
});
