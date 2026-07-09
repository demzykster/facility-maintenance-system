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
});
