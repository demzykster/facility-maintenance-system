import { describe, expect, it, vi } from "vitest";
import { createTicketsApiHandler } from "../server/tickets/handler.js";
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

describe("tickets API handler", () => {
  it("requires a Supabase or CMMS bearer token", async () => {
    const handler = createTicketsApiHandler({ driver: { upsert: vi.fn() } });

    const res = await call(handler, { body: { id: "T-1" } });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "supabase_access_token_required" });
  });

  it("does not claim ticket operations work before the backend is configured", async () => {
    const handler = createTicketsApiHandler({ sessionClient: sessionClientFor() });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "T-1" }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "tickets_backend_not_configured" });
  });

  it("upserts a normalized ticket and writes an audit event for allowed sessions", async () => {
    const driver = { upsert: vi.fn().mockResolvedValue({ id: "T-1" }) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createTicketsApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "T-1", num: 1, status: "open", track: "facility", subject: "Door" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, ticket: { id: "T-1", status: "open", sourceKvKey: "ticket:T-1" } });
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "T-1", status: "open" }));
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "ticket",
      entityId: "T-1",
      action: "update"
    }));
  });

  it("lists normalized tickets for active ticket roles", async () => {
    const driver = { list: vi.fn().mockResolvedValue([{ id: "T-1", status: "open" }]), get: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "tech" })
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: "Bearer tech-token" },
      query: { limit: "25" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tickets: [{ id: "T-1", status: "open" }] });
    expect(driver.list).toHaveBeenCalledWith({ limit: "25" });
  });

  it("gets one normalized ticket with active file metadata", async () => {
    const driver = {
      list: vi.fn(),
      get: vi.fn().mockResolvedValue({ id: "T-1", status: "open" })
    };
    const metadataDriver = {
      listActiveByOwner: vi.fn().mockResolvedValue([{ ownerType: "ticket", ownerId: "T-1", path: "tickets/T-1/before.jpg" }])
    };
    const handler = createTicketsApiHandler({
      driver,
      metadataDriver,
      sessionClient: sessionClientFor({ permissions: { tickets: "view" } })
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: "Bearer user-token" },
      query: { id: "T-1", includeFiles: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      ticket: {
        id: "T-1",
        status: "open",
        files: [{ ownerType: "ticket", ownerId: "T-1", path: "tickets/T-1/before.jpg" }]
      }
    });
    expect(metadataDriver.listActiveByOwner).toHaveBeenCalledWith("ticket", "T-1");
  });

  it("blocks cleaner sessions from reading normalized tickets", async () => {
    const driver = { list: vi.fn(), get: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "cleaner" })
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: "Bearer cleaner-token" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:tickets:view" });
    expect(driver.list).not.toHaveBeenCalled();
  });

  it("accepts CMMS PIN worker sessions for ticket reporting", async () => {
    const driver = { upsert: vi.fn().mockResolvedValue({ id: "T-2" }) };
    const sessionClient = { getAuthUser: vi.fn(), getAppUserProfile: vi.fn() };
    const token = signCmmsSessionToken("worker-1", "worker", "1042", "session-secret", Date.now()).token;
    const handler = createTicketsApiHandler({
      driver,
      sessionClient,
      env: { CMMS_SESSION_SECRET: "session-secret" }
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: { id: "T-2", status: "new" }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "T-2" }));
    expect(sessionClient.getAuthUser).not.toHaveBeenCalled();
  });

  it("blocks roles that cannot write tickets", async () => {
    const driver = { upsert: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "cleaner" })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer cleaner-token" },
      body: { id: "T-3", status: "new" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:role:admin|user|tech|worker" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("deletes normalized tickets for sessions allowed to write tickets", async () => {
    const driver = { delete: vi.fn().mockResolvedValue(undefined) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createTicketsApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { id: "T-4" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, ticket: { id: "T-4" }, cleanup: { files: 0, metadata: false, errors: 0 } });
    expect(driver.delete).toHaveBeenCalledWith("T-4");
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "ticket",
      entityId: "T-4",
      action: "delete"
    }));
  });

  it("cleans ticket-owned files when deleting a normalized ticket", async () => {
    const driver = { delete: vi.fn().mockResolvedValue(undefined) };
    const metadataDriver = {
      listActiveByOwner: vi.fn().mockResolvedValue([
        { ownerType: "ticket", ownerId: "T-5", path: "tickets/T-5/before.jpg" },
        { ownerType: "ticket", ownerId: "T-5", path: "tickets/T-5/after.jpg" }
      ]),
      markDeletedByOwner: vi.fn().mockResolvedValue(undefined)
    };
    const fileDriver = { delete: vi.fn().mockResolvedValue(undefined) };
    const handler = createTicketsApiHandler({
      driver,
      metadataDriver,
      fileDriver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { id: "T-5" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, ticket: { id: "T-5" }, cleanup: { files: 2, metadata: true, errors: 0 } });
    expect(metadataDriver.listActiveByOwner).toHaveBeenCalledWith("ticket", "T-5");
    expect(fileDriver.delete).toHaveBeenCalledWith("tickets/T-5/before.jpg");
    expect(fileDriver.delete).toHaveBeenCalledWith("tickets/T-5/after.jpg");
    expect(metadataDriver.markDeletedByOwner).toHaveBeenCalledWith("ticket", "T-5");
  });
});
