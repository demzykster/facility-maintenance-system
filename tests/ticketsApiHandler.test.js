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

  it("creates a new normalized ticket through the server-authoritative create path", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        ticketId: "T-1",
        num: 42,
        ticketNo: "F-042",
        status: "new",
        idempotencyStatus: "created"
      }),
      upsert: vi.fn()
    };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createTicketsApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "T-1", num: 1, status: "open", track: "facility", subject: "Door", description: "Door is stuck", category: "doors" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      ticket: { id: "T-1", num: 42, ticketNo: "F-042", sourceKvKey: "ticket:T-1" },
      action: "created",
      actionResult: { type: "ticket.create", ticketId: "T-1", num: 42, ticketNumber: "F-042", ticketNo: "F-042" }
    });
    expect(driver.get).toHaveBeenCalledWith("T-1");
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({ id: "T-1", num: null, status: "open" }), expect.objectContaining({
      actorId: "app-user-1",
      idempotencyKey: "ticket:app-user-1:T-1",
      requestHash: expect.any(String)
    }));
    expect(driver.upsert).not.toHaveBeenCalled();
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "ticket",
      entityId: "T-1",
      action: "create"
    }));
  });

  it("keeps legacy create working without RPC when the server-create cutover is disabled", async () => {
    const driver = {
      list: vi.fn().mockResolvedValue([
        { id: "old-f", track: "facility", num: 7 },
        { id: "old-t", track: "transport", num: 12, forkliftId: "forklift-1" }
      ]),
      get: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket })),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "T-legacy", track: "facility", subject: "Door", description: "Door is stuck", category: "doors" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      action: "created",
      numberingMode: "legacy",
      ticket: { id: "T-legacy", num: 8 }
    });
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "T-legacy", num: 8 }));
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("keeps manual create on the legacy path when only the AI autonomous flag is enabled", async () => {
    const driver = {
      list: vi.fn().mockResolvedValue([{ id: "old-f", track: "facility", num: 10 }]),
      get: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket })),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } }),
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "true"
      }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "T-ai-flag-manual", track: "facility", subject: "Door", description: "Door is stuck", category: "doors" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      action: "created",
      numberingMode: "legacy",
      ticket: { id: "T-ai-flag-manual", num: 11 }
    });
    expect(driver.create).not.toHaveBeenCalled();
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "T-ai-flag-manual", num: 11 }));
  });

  it("does not save num null in the legacy cutover-off path", async () => {
    const driver = {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket }))
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "T-first", track: "transport", subject: "Fan", description: "Fan stopped", category: "transport", forkliftId: "forklift-1", downtimeType: "needs_triage" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ticket.num).toBe(1);
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ num: 1 }));
  });

  it("returns a controlled error without partial write when cutover is enabled but RPC is missing", async () => {
    const driver = {
      list: vi.fn(),
      get: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      create: vi.fn().mockRejectedValue(new Error("Could not find function public.cmms_create_ticket"))
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "T-rpc-missing", track: "facility", num: 99, subject: "Door", description: "Door is stuck", category: "doors" }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "ticket_create_rpc_unavailable" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("restores the legacy create path when the cutover is disabled again", async () => {
    const driver = {
      list: vi.fn().mockResolvedValue([{ id: "old", track: "facility", num: 2 }]),
      get: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket })),
      create: vi.fn().mockRejectedValue(new Error("cmms_create_ticket missing"))
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "false" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "T-restored", track: "facility", subject: "Door", description: "Door is stuck", category: "doors" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ numberingMode: "legacy", ticket: { num: 3 } });
    expect(driver.create).not.toHaveBeenCalled();
    expect(driver.upsert).toHaveBeenCalled();
  });

  it("updates existing normalized tickets without changing or reallocating num", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue({ id: "T-9", num: 7, status: "new", legacyPayload: { id: "T-9", num: 7, status: "new" } }),
      upsert: vi.fn().mockResolvedValue({ id: "T-9", status: "open", legacy_payload: { id: "T-9", num: 7, status: "open" } }),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "T-9", num: 99, status: "open", track: "facility", subject: "Door", description: "Door is stuck", category: "doors" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, action: "updated", ticket: { id: "T-9", num: 7 } });
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "T-9", num: 7, status: "open" }));
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("preserves facility close timestamps when updating an existing ticket", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue({ id: "F-2", num: 2, status: "pending_admin", legacyPayload: { id: "F-2", num: 2, status: "pending_admin" } }),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket })),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        id: "F-2",
        num: 99,
        track: "facility",
        status: "done",
        subject: "Door",
        description: "Door is fixed",
        category: "doors",
        closedAt: 3_000,
        closure: { signedAt: 3_000, recordedAt: 4_000, signedBy: "Admin", costAmount: 0, quality: "resolved" }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "F-2",
      num: 2,
      status: "done",
      closedAt: 3_000,
      closure: expect.objectContaining({ signedAt: 3_000 })
    }));
    expect(res.json()).toMatchObject({
      ok: true,
      action: "updated",
      ticket: { id: "F-2", num: 2, status: "done", closedAt: 3_000 }
    });
  });

  it("updates existing normalized tickets through the old upsert branch when cutover is disabled", async () => {
    const driver = {
      list: vi.fn(),
      get: vi.fn().mockResolvedValue({ id: "T-8", num: 5, status: "new", legacyPayload: { id: "T-8", num: 5, status: "new" } }),
      upsert: vi.fn().mockResolvedValue({ id: "T-8", status: "open", legacy_payload: { id: "T-8", num: 5, status: "open" } }),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "false" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "T-8", num: 999, status: "open", track: "facility", subject: "Door", description: "Door is stuck", category: "doors" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, action: "updated", ticket: { id: "T-8", num: 5 } });
    expect(driver.create).not.toHaveBeenCalled();
    expect(driver.list).not.toHaveBeenCalled();
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

  it("lists normalized tickets for executive BI sessions", async () => {
    const driver = { list: vi.fn().mockResolvedValue([{ id: "T-1", status: "open" }]), get: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "executive" })
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: "Bearer executive-token" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tickets: [{ id: "T-1", status: "open" }] });
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
    const driver = {
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        ticketId: "T-2",
        num: 1,
        ticketNo: "F-001",
        status: "new",
        idempotencyStatus: "created"
      })
    };
    const sessionClient = { getAuthUser: vi.fn(), getAppUserProfile: vi.fn() };
    const token = signCmmsSessionToken("worker-1", "worker", "1042", "session-secret", Date.now()).token;
    const handler = createTicketsApiHandler({
      driver,
      sessionClient,
      env: { CMMS_SESSION_SECRET: "session-secret", CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: { id: "T-2", status: "new", track: "facility", subject: "Worker report", description: "Worker reported an issue", category: "general" }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({ id: "T-2" }), expect.objectContaining({ actorId: "worker-1" }));
    expect(sessionClient.getAuthUser).not.toHaveBeenCalled();
  });

  it("rejects new normalized creates that do not satisfy the shared create contract", async () => {
    const driver = { get: vi.fn().mockResolvedValue(null), create: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { id: "T-missing", track: "transport", subject: "Fan", category: "transport", downtimeType: "needs_triage" }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "ticket_create_fields_required", fields: ["description", "forkliftId"] });
    expect(driver.create).not.toHaveBeenCalled();
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
