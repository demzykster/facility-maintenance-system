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

function pinSessionClientFor(user = {}) {
  return {
    findPinSessionUser: vi.fn().mockResolvedValue({
      id: "tech-sharon",
      role: "tech",
      name: "שרון",
      active: true,
      techScope: "transport",
      supplier: "טויוטה",
      permissions: {},
      ...user
    })
  };
}

const ticketRecord = (ticket = {}) => ({
  id: ticket.id || "T-1",
  track: ticket.track || "facility",
  status: ticket.status || "new",
  subject: ticket.subject || "Door",
  description: ticket.description || "Door is stuck",
  category: ticket.category || "doors",
  priority: ticket.priority || "medium",
  ...ticket
});

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
      body: {
        id: "T-1",
        num: 1,
        ticketNo: "F-999",
        ticketNumber: "F-999",
        status: "open",
        createdAt: 1,
        updatedAt: 2,
        sourceKvKey: "ticket:attacker",
        actor_id: "attacker",
        createdBy: { id: "attacker", name: "Attacker", role: "admin" },
        reportedBy: { id: "attacker", name: "Attacker", role: "admin" },
        track: "facility",
        subject: "Door",
        description: "Door is stuck",
        category: "doors",
        priority: "medium"
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      ticket: { id: "T-1", num: 42, ticketNo: "F-042", sourceKvKey: "ticket:T-1" },
      action: "created",
      actionResult: { type: "ticket.create", ticketId: "T-1", num: 42, ticketNumber: "F-042", ticketNo: "F-042" }
    });
    expect(driver.get).toHaveBeenCalledWith("T-1");
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({
      id: "T-1",
      num: null,
      status: "new",
      createdBy: { id: "app-user-1", name: "Manager", role: "user" },
      reportedBy: { id: "app-user-1", name: "Manager", role: "user" }
    }), expect.objectContaining({
      actorId: "app-user-1",
      idempotencyKey: "ticket:app-user-1:T-1",
      requestHash: expect.any(String)
    }));
    const persistedTicket = driver.create.mock.calls[0][0];
    expect(persistedTicket.ticketNo).toBeUndefined();
    expect(persistedTicket.ticketNumber).toBeUndefined();
    expect(persistedTicket.createdAt).toBeUndefined();
    expect(persistedTicket.updatedAt).toBeUndefined();
    expect(persistedTicket.actor_id).toBeUndefined();
    expect(persistedTicket.sourceKvKey).toBeUndefined();
    expect(driver.upsert).not.toHaveBeenCalled();
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "ticket",
      entityId: "T-1",
      action: "create"
    }));
  });

  it("replays an explicit create when the existing ticket has the same create content", async () => {
    const existing = {
      id: "T-replay",
      num: 11,
      ticketNo: "F-011",
      track: "facility",
      subject: "Door",
      description: "Door is stuck",
      category: "doors",
      priority: "medium",
      status: "new"
    };
    const driver = {
      get: vi.fn().mockResolvedValue({ legacy_payload: existing }),
      create: vi.fn(),
      upsert: vi.fn()
    };
    const auditDriver = { write: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "create",
        ticket: { ...existing, num: 999 }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      action: "replayed",
      ticket: { id: "T-replay", num: 11 },
      actionResult: {
        type: "ticket.create",
        ticketId: "T-replay",
        idempotencyStatus: "replayed"
      }
    });
    expect(driver.create).not.toHaveBeenCalled();
    expect(driver.upsert).not.toHaveBeenCalled();
    expect(auditDriver.write).not.toHaveBeenCalled();
  });

  it("replays an explicit create when only forbidden system fields differ", async () => {
    const existing = {
      id: "T-replay-system",
      num: 11,
      ticketNo: "F-011",
      track: "facility",
      subject: "Door",
      description: "Door is stuck",
      category: "doors",
      status: "new",
      reportedBy: { id: "app-user-1", name: "Manager", role: "user" }
    };
    const driver = {
      get: vi.fn().mockResolvedValue({ legacy_payload: existing }),
      create: vi.fn(),
      upsert: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "create",
        ticket: {
          ...existing,
          status: "done",
          createdAt: 1,
          updatedAt: 2,
          sourceKvKey: "ticket:attacker",
          actor_id: "attacker",
          reportedBy: { id: "attacker", name: "Attacker", role: "admin" }
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      action: "replayed",
      ticket: { id: "T-replay-system", num: 11, status: "new" }
    });
    expect(driver.create).not.toHaveBeenCalled();
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("allows executive sessions to create new tickets without granting update rights", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        ticketId: "T-exec-create",
        num: 44,
        ticketNo: "F-044",
        status: "new",
        idempotencyStatus: "created"
      }),
      upsert: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "executive-1", role: "executive", name: "Executive" }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer executive-token" },
      body: {
        operation: "create",
        ticket: ticketRecord({
          id: "T-exec-create",
          track: "facility",
          subject: "Executive facility report",
          description: "Executive opened a facility issue",
          category: "doors",
          status: "pending_manager"
        })
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      action: "created",
      ticket: { id: "T-exec-create", num: 44, ticketNo: "F-044" }
    });
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({
      id: "T-exec-create",
      status: "new",
      createdBy: { id: "executive-1", name: "Executive", role: "executive" },
      reportedBy: { id: "executive-1", name: "Executive", role: "executive" }
    }), expect.objectContaining({
      actorId: "executive-1",
      idempotencyKey: "ticket:executive-1:T-exec-create"
    }));
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("allows executive exact create replays without turning them into updates", async () => {
    const existing = ticketRecord({
      id: "T-exec-replay",
      num: 45,
      ticketNo: "F-045",
      track: "facility",
      subject: "Executive facility report",
      description: "Executive opened a facility issue",
      category: "doors",
      status: "new"
    });
    const driver = {
      get: vi.fn().mockResolvedValue({ legacy_payload: existing }),
      create: vi.fn(),
      upsert: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "executive-1", role: "executive", name: "Executive" }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer executive-token" },
      body: {
        operation: "create",
        ticket: existing
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      action: "replayed",
      ticket: { id: "T-exec-replay", num: 45, status: "new" }
    });
    expect(driver.create).not.toHaveBeenCalled();
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("rejects an explicit create when the same ticket id already has different content", async () => {
    const existing = {
      id: "T-conflict",
      num: 12,
      track: "facility",
      subject: "Door",
      description: "Door is stuck",
      category: "doors",
      status: "new"
    };
    const driver = {
      get: vi.fn().mockResolvedValue({ legacy_payload: existing }),
      create: vi.fn(),
      upsert: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "create",
        ticket: { ...existing, subject: "Window" }
      }
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: "ticket_create_id_conflict",
      message: "ticket_id_already_used_for_different_content"
    });
    expect(driver.create).not.toHaveBeenCalled();
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("keeps exact idempotency-key replays on the create RPC path", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        ticketId: "T-idem-original",
        num: 43,
        ticketNo: "F-043",
        status: "new",
        idempotencyStatus: "replayed"
      }),
      upsert: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token", "idempotency-key": "idem-1" },
      body: {
        operation: "create",
        ticket: { id: "T-idem-retry", track: "facility", subject: "Door", description: "Door is stuck", category: "doors", priority: "medium" }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      action: "replayed",
      ticket: { id: "T-idem-original", num: 43 },
      actionResult: { idempotencyStatus: "replayed" }
    });
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({ id: "T-idem-retry" }), expect.objectContaining({
      idempotencyKey: "idem-1"
    }));
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("returns conflict when a new id reuses an idempotency key with different create content", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockRejectedValue(new Error("idempotency_conflict")),
      upsert: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token", "idempotency-key": "idem-1" },
      body: {
        operation: "create",
        ticket: { id: "T-new-id", track: "facility", subject: "Window", description: "Window is stuck", category: "doors", priority: "medium" }
      }
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "idempotency_conflict" });
    expect(driver.upsert).not.toHaveBeenCalled();
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

  it("keeps explicit create on the legacy upsert path when the server-create cutover is disabled", async () => {
    const driver = {
      list: vi.fn(),
      get: vi.fn().mockResolvedValue({ id: "T-legacy-update", num: 4, status: "new", legacyPayload: { id: "T-legacy-update", num: 4, status: "new" } }),
      upsert: vi.fn().mockResolvedValue({ legacy_payload: { id: "T-legacy-update", num: 4, status: "open" } }),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "false" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "create",
        ticket: { id: "T-legacy-update", num: 999, status: "open", track: "facility", subject: "Door", description: "Door changed", category: "doors" }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, action: "updated", ticket: { id: "T-legacy-update", num: 4, status: "open" } });
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "T-legacy-update", num: 4, status: "open" }));
    expect(driver.create).not.toHaveBeenCalled();
    expect(driver.list).not.toHaveBeenCalled();
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
      body: { id: "T-first", track: "transport", subject: "Fan", description: "Fan stopped", category: "transport", priority: "medium", forkliftId: "forklift-1", downtimeType: "needs_triage" }
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
      body: { id: "T-rpc-missing", track: "facility", num: 99, subject: "Door", description: "Door is stuck", category: "doors", priority: "medium" }
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
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "manage" } }),
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

  it("updates existing normalized tickets only when the caller uses the explicit update operation", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue({ id: "T-update", num: 8, status: "new", legacyPayload: { id: "T-update", num: 8, status: "new" } }),
      upsert: vi.fn().mockResolvedValue({ legacy_payload: { id: "T-update", num: 8, status: "open" } }),
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
        operation: "update",
        ticket: { id: "T-update", num: 99, status: "open", track: "facility", subject: "Door", description: "Door is fixed", category: "doors" }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, action: "updated", ticket: { id: "T-update", num: 8, status: "open" } });
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "T-update", num: 8, status: "open" }));
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("does not create a ticket through the explicit update operation when the ticket is missing", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { id: "T-missing-update", track: "facility", subject: "Door", description: "Door is fixed", category: "doors" }
      }
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "ticket_not_found" });
    expect(driver.create).not.toHaveBeenCalled();
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("blocks worker updates to tickets outside the worker object scope", async () => {
    const foreignTicket = ticketRecord({
      id: "T-worker-foreign",
      reportedBy: { id: "worker-2", name: "Worker B" },
      createdBy: { id: "worker-2", name: "Worker B", role: "worker" }
    });
    const driver = {
      get: vi.fn().mockResolvedValue(foreignTicket),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "worker-1", role: "worker", name: "Worker A" }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer worker-token" },
      body: {
        operation: "update",
        ticket: { ...foreignTicket, status: "cancelled" }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:tickets:write_scope" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("allows worker updates to tickets inside the worker object scope", async () => {
    const ownTicket = ticketRecord({
      id: "T-worker-own",
      reportedBy: { id: "worker-1", name: "Worker A" },
      createdBy: { id: "worker-1", name: "Worker A", role: "worker" }
    });
    const driver = {
      get: vi.fn().mockResolvedValue(ownTicket),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket })),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "worker-1", role: "worker", name: "Worker A" }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer worker-token" },
      body: {
        operation: "update",
        ticket: { ...ownTicket, status: "cancelled" }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, action: "updated", ticket: { id: "T-worker-own", status: "cancelled" } });
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "T-worker-own", status: "cancelled" }));
  });

  it("blocks worker direct-id and query-param bypasses when updating another worker's ticket", async () => {
    const foreignTicket = ticketRecord({
      id: "T-worker-foreign",
      reportedBy: { id: "worker-2", name: "Worker B" }
    });
    const driver = {
      get: vi.fn().mockResolvedValue(foreignTicket),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "worker-1", role: "worker", name: "Worker A" }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer worker-token" },
      query: { id: "T-worker-own", includeFiles: "1" },
      body: {
        operation: "update",
        ticket: { ...foreignTicket, status: "cancelled" }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:tickets:write_scope" });
    expect(driver.get).toHaveBeenCalledWith("T-worker-foreign");
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("blocks technicians from updating tickets outside their tech scope", async () => {
    const outsideScope = ticketRecord({
      id: "T-tech-other",
      track: "facility",
      routedTech: true,
      category: "plumbing"
    });
    const driver = {
      get: vi.fn().mockResolvedValue(outsideScope),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "tech-1", role: "tech", name: "Tech One", tech_scope: "facility", tech_cats: ["electric"] }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer tech-token" },
      body: {
        operation: "update",
        ticket: { ...outsideScope, status: "in_progress" }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:tickets:write_scope" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("blocks managers from updating tickets outside department and fleet scope", async () => {
    const outsideScope = ticketRecord({
      id: "T-manager-other",
      track: "facility",
      department: "Other"
    });
    const driver = {
      get: vi.fn().mockResolvedValue(outsideScope),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const fleetDriver = { list: vi.fn().mockResolvedValue([]) };
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver,
      sessionClient: sessionClientFor({ id: "manager-1", role: "user", name: "Manager", department: "Ops", departments: ["Ops"] }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { ...outsideScope, status: "in_progress" }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:tickets:write_scope" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("keeps executive ticket sessions read-only for updates", async () => {
    const driver = {
      get: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "executive-1", role: "executive" }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer executive-token" },
      body: {
        operation: "update",
        ticket: ticketRecord({ id: "T-exec", status: "in_progress" })
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:role:admin|user|tech|worker" });
    expect(driver.get).not.toHaveBeenCalled();
    expect(driver.upsert).not.toHaveBeenCalled();
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

  it("allows admin to close active facility tickets with closure fields", async () => {
    const existing = ticketRecord({ id: "F-active-close", status: "in_progress", track: "facility", category: "doors" });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket })),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "admin", name: "Admin", permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: {
          ...existing,
          status: "done",
          closedAt: 3_000,
          closure: { signedAt: 3_000, recordedAt: 4_000, signedBy: "Admin", costAmount: 0, quality: "resolved" }
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "F-active-close",
      status: "done",
      closedAt: 3_000,
      closure: expect.objectContaining({ signedBy: "Admin", quality: "resolved" })
    }));
  });

  it("rejects active facility close without closure fields", async () => {
    const existing = ticketRecord({ id: "F-active-close-missing", status: "in_progress", track: "facility", category: "doors" });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "admin", name: "Admin", permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { ...existing, status: "done" }
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "ticket_transition_required_fields_missing:closure" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("rejects arbitrary status jumps on normalized ticket updates", async () => {
    const existing = ticketRecord({ id: "T-jump", status: "new", track: "transport", forkliftId: "fork-ops", supplier: "Toyota" });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(),
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
        operation: "update",
        ticket: { ...existing, status: "done", closedAt: 3_000, closure: { signedAt: 3_000, signedBy: "Admin", quality: "resolved" } }
      }
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "ticket_transition_forbidden:new:done" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("keeps final ticket closure admin-only on normalized updates", async () => {
    const existing = ticketRecord({ id: "F-admin-close", status: "pending_admin", track: "facility", createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "manager-1", role: "user", name: "Manager", dept: "Ops", departments: ["Ops"], permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { ...existing, status: "done" }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "ticket_transition_role_forbidden:user:pending_admin:done" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("allows manager rework to return transport tickets to the accepted technician", async () => {
    const existing = ticketRecord({ id: "T-rework-return", status: "pending_user", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "Sharon", routedTech: true, createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket })),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      sessionClient: sessionClientFor({ id: "manager-1", role: "user", name: "Manager", dept: "Ops", departments: ["Ops"], permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { ...existing, status: "in_progress", returned: true }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "T-rework-return",
      status: "in_progress",
      supplier: "Toyota",
      assignee: "Sharon",
      routedTech: true,
      returned: true
    }));
  });

  it("allows an eligible supplier technician to accept a transport ticket through the API", async () => {
    const existing = ticketRecord({ id: "T-accept", status: "new", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "", routedTech: true });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket })),
      create: vi.fn()
    };
    const token = signCmmsSessionToken("tech-sharon", "tech", "", "session-secret", Date.now()).token;
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      pinSessionClient: pinSessionClientFor({ id: "tech-sharon", name: "Sharon", supplier: "Toyota", techScope: "transport" }),
      env: { CMMS_SESSION_SECRET: "session-secret", CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: {
        operation: "update",
        ticket: { ...existing, status: "in_progress", assignee: "Sharon" }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "T-accept",
      status: "in_progress",
      assignee: "Sharon",
      supplier: "Toyota"
    }));
  });

  it("allows an eligible supplier technician to report that a queued transport tool was not received", async () => {
    const existing = ticketRecord({ id: "T-no-equipment", status: "new", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "", routedTech: true });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket })),
      create: vi.fn()
    };
    const token = signCmmsSessionToken("tech-sharon", "tech", "", "session-secret", Date.now()).token;
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      pinSessionClient: pinSessionClientFor({ id: "tech-sharon", name: "Sharon", supplier: "Toyota", techScope: "transport" }),
      env: { CMMS_SESSION_SECRET: "session-secret", CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: {
        operation: "update",
        ticket: {
          ...existing,
          status: "waiting",
          waitingReason: "no_equipment",
          waitBall: "manager",
          assignee: "Sharon",
          equipWaitSince: 3_000
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "T-no-equipment",
      status: "waiting",
      waitingReason: "no_equipment",
      waitBall: "manager",
      assignee: "Sharon",
      supplier: "Toyota",
      routedTech: true,
      equipWaitSince: 3_000
    }));
  });

  it("rejects arbitrary waiting reasons before supplier technician acceptance", async () => {
    const existing = ticketRecord({ id: "T-wait-before-accept", status: "new", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "", routedTech: true });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const token = signCmmsSessionToken("tech-sharon", "tech", "", "session-secret", Date.now()).token;
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      pinSessionClient: pinSessionClientFor({ id: "tech-sharon", name: "Sharon", supplier: "Toyota", techScope: "transport" }),
      env: { CMMS_SESSION_SECRET: "session-secret", CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: {
        operation: "update",
        ticket: { ...existing, status: "waiting", waitingReason: "parts", waitBall: "executor", assignee: "Sharon" }
      }
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "transport_pre_acceptance_waiting_reason_forbidden" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("rejects transport acceptance by a manager before supplier technician acceptance", async () => {
    const existing = ticketRecord({ id: "T-manager-accept", status: "new", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "", routedTech: true, createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      sessionClient: sessionClientFor({ id: "manager-1", role: "user", name: "Manager", dept: "Ops", departments: ["Ops"], permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { ...existing, status: "in_progress", assignee: "Manager" }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "transport_acceptance_actor_forbidden" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("rejects transport acceptance when the technician assigns another person", async () => {
    const existing = ticketRecord({ id: "T-assignee-mismatch", status: "new", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "", routedTech: true });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const token = signCmmsSessionToken("tech-sharon", "tech", "", "session-secret", Date.now()).token;
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      pinSessionClient: pinSessionClientFor({ id: "tech-sharon", name: "Sharon", supplier: "Toyota", techScope: "transport" }),
      env: { CMMS_SESSION_SECRET: "session-secret", CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: {
        operation: "update",
        ticket: { ...existing, status: "in_progress", assignee: "Dana" }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "transport_acceptance_assignee_mismatch" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("rejects admin attempts to imitate supplier technician acceptance", async () => {
    const existing = ticketRecord({ id: "T-admin-accept", status: "new", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "", routedTech: true });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", name: "Admin", permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { ...existing, status: "in_progress", assignee: "Admin" }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "transport_acceptance_actor_forbidden" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("blocks direct API rework reassignment to a different transport technician", async () => {
    const existing = ticketRecord({ id: "T-rework-hijack", status: "pending_user", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "Sharon", routedTech: true, createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      sessionClient: sessionClientFor({ id: "manager-1", role: "user", name: "Manager", dept: "Ops", departments: ["Ops"], permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { ...existing, status: "in_progress", assignee: "Dana", returned: true }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "ticket_rework_assignee_change_forbidden" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("blocks technician cancellation of active tickets through the API", async () => {
    const existing = ticketRecord({ id: "T-tech-cancel", status: "in_progress", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "Sharon", routedTech: true });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const token = signCmmsSessionToken("tech-sharon", "tech", "", "session-secret", Date.now()).token;
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      pinSessionClient: pinSessionClientFor({ id: "tech-sharon", name: "Sharon", supplier: "Toyota", techScope: "transport" }),
      env: { CMMS_SESSION_SECRET: "session-secret", CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: {
        operation: "update",
        ticket: { ...existing, status: "cancelled" }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "ticket_transition_technician_cancel_forbidden" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("allows an authorized admin cancellation and records update audit", async () => {
    const existing = ticketRecord({ id: "T-admin-cancel", status: "in_progress", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "Sharon", routedTech: true, createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket })),
      create: vi.fn()
    };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createTicketsApiHandler({
      driver,
      auditDriver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", name: "Admin", permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { ...existing, status: "cancelled" }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "T-admin-cancel", status: "cancelled" }));
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "admin-1",
      action: "update"
    }));
  });

  it("requires the actual manager owner for direct API approval", async () => {
    const existing = ticketRecord({ id: "T-approval-owner", status: "pending_user", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "Sharon", routedTech: true, createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      sessionClient: sessionClientFor({ id: "manager-2", role: "user", name: "Other Manager", dept: "Ops", departments: ["Ops"], permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { ...existing, status: "pending_admin" }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "ticket_transition_manager_ownership_forbidden" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("blocks admin approval shortcuts before final closure", async () => {
    const existing = ticketRecord({ id: "T-admin-shortcut", status: "pending_user", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "Sharon", routedTech: true, createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", name: "Admin", permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { ...existing, status: "pending_admin" }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "ticket_admin_shortcut_forbidden" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("blocks admin shortcuts from active work directly to pending admin", async () => {
    const existing = ticketRecord({ id: "T-admin-active-shortcut", status: "in_progress", track: "transport", forkliftId: "fork-ops", supplier: "Toyota", assignee: "Sharon", routedTech: true, createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver: { list: vi.fn().mockResolvedValue([{ id: "fork-ops", depts: ["Ops"], supplier: "Toyota" }]) },
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", name: "Admin", permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { ...existing, status: "pending_admin" }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "ticket_admin_shortcut_forbidden" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("keeps ordinary facility execution updates out of the transport acceptance guard", async () => {
    const existing = ticketRecord({ id: "F-manager-exec", status: "new", track: "facility", assignee: "Manager", mgrExec: true, createdBy: { id: "manager-1", name: "Manager", role: "user", dept: "Ops" } });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket })),
      create: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "manager-1", role: "user", name: "Manager", dept: "Ops", departments: ["Ops"], permissions: { tickets: "manage" } }),
      env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "update",
        ticket: { ...existing, status: "in_progress" }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "F-manager-exec", status: "in_progress", track: "facility" }));
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
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "manage" } }),
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
    const driver = { list: vi.fn().mockResolvedValue([{ id: "T-1", status: "open", track: "facility", routedTech: true }]), get: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "tech", tech_scope: "facility" })
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: "Bearer tech-token" },
      query: { limit: "25" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tickets: [{ id: "T-1", status: "open", track: "facility", routedTech: true }] });
    expect(driver.list).toHaveBeenCalledWith({ limit: "25" });
  });

  it("scopes worker ticket lists to tickets reported by the worker", async () => {
    const own = { id: "T-own", status: "open", reportedBy: { id: "worker-1", name: "Worker" } };
    const other = { id: "T-other", status: "open", reportedBy: { id: "worker-2", name: "Other" } };
    const driver = { list: vi.fn().mockResolvedValue([own, other]), get: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "worker-1", role: "worker", name: "Worker" })
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: "Bearer worker-token" },
      query: { limit: "25" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tickets: [own] });
  });

  it("blocks worker direct reads of another worker's ticket", async () => {
    const driver = {
      list: vi.fn(),
      get: vi.fn().mockResolvedValue({ id: "T-other", status: "open", reportedBy: { id: "worker-2", name: "Other" } })
    };
    const metadataDriver = { listActiveByOwner: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      metadataDriver,
      sessionClient: sessionClientFor({ id: "worker-1", role: "worker", name: "Worker" })
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: "Bearer worker-token" },
      query: { id: "T-other", includeFiles: "1", limit: "1000" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:tickets:view_scope" });
    expect(metadataDriver.listActiveByOwner).not.toHaveBeenCalled();
  });

  it("keeps admin full ticket read access", async () => {
    const tickets = [
      { id: "T-worker", status: "open", reportedBy: { id: "worker-1" } },
      { id: "T-other", status: "open", reportedBy: { id: "worker-2" } }
    ];
    const driver = { list: vi.fn().mockResolvedValue(tickets), get: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin" })
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: "Bearer admin-token" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tickets });
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

  it("keeps manager ticket reads scoped to owned, assigned, and department tickets", async () => {
    const tickets = [
      { id: "T-own", track: "facility", createdBy: { id: "manager-1", name: "Manager", dept: "Ops" } },
      { id: "T-assigned", track: "facility", assignee: "Manager" },
      { id: "T-dept", track: "facility", department: "Ops" },
      { id: "T-fleet-dept", track: "transport", forkliftId: "forklift-ops" },
      { id: "T-other", track: "facility", department: "Other" }
    ];
    const driver = { list: vi.fn().mockResolvedValue(tickets), get: vi.fn() };
    const fleetDriver = { list: vi.fn().mockResolvedValue([{ id: "forklift-ops", depts: ["Ops"] }]) };
    const handler = createTicketsApiHandler({
      driver,
      fleetDriver,
      sessionClient: sessionClientFor({ id: "manager-1", role: "user", name: "Manager", department: "Ops", departments: ["Ops"] })
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: "Bearer user-token" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tickets: tickets.slice(0, 4) });
  });

  it("keeps technician ticket reads scoped to assigned or free tickets in tech scope", async () => {
    const tickets = [
      { id: "T-assigned", track: "facility", assignee: "Tech One", routedTech: true, category: "electric" },
      { id: "T-free", track: "facility", routedTech: true, category: "electric" },
      { id: "T-other-cat", track: "facility", routedTech: true, category: "plumbing" },
      { id: "T-not-routed", track: "facility", category: "electric" }
    ];
    const driver = { list: vi.fn().mockResolvedValue(tickets), get: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "tech-1", role: "tech", name: "Tech One", tech_scope: "facility", tech_cats: ["electric"] })
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: "Bearer tech-token" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tickets: tickets.slice(0, 2) });
  });

  it("hydrates CMMS PIN supplier technicians before applying transport ticket read scope", async () => {
    const tickets = [
      { id: "T-queue", track: "transport", status: "new", supplier: "טויוטה", assignee: "", routedTech: true },
      { id: "T-accepted", track: "transport", status: "in_progress", supplier: "טויוטה", assignee: "שרון", routedTech: true },
      { id: "T-rework", track: "transport", status: "rework", supplier: "טויוטה", assignee: "שרון", routedTech: true },
      { id: "T-returned", track: "transport", status: "in_progress", supplier: "טויוטה", assignee: "שרון", routedTech: true, returned: true },
      { id: "T-legacy-queue", track: "transport", status: "new", supplier: "טויוטה", assignee: "טויוטה", routedTech: true },
      { id: "T-other-tech", track: "transport", status: "in_progress", supplier: "טויוטה", assignee: "דוד", routedTech: true },
      { id: "T-other-supplier", track: "transport", status: "new", supplier: "יונגהיינריך", assignee: "", routedTech: true },
      { id: "F-facility", track: "facility", status: "new", assignee: "", routedTech: true }
    ];
    const driver = { list: vi.fn().mockResolvedValue(tickets), get: vi.fn() };
    const pinSessionClient = pinSessionClientFor();
    const token = signCmmsSessionToken("tech-sharon", "tech", "", "session-secret", Date.now()).token;
    const handler = createTicketsApiHandler({
      driver,
      pinSessionClient,
      env: { CMMS_SESSION_SECRET: "session-secret" }
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tickets: tickets.slice(0, 5) });
    expect(pinSessionClient.findPinSessionUser).toHaveBeenCalledWith(expect.objectContaining({
      id: "tech-sharon",
      role: "tech"
    }));
  });

  it("shows a supplier queue to another supplier technician without exposing accepted tickets", async () => {
    const tickets = [
      { id: "T-queue", track: "transport", status: "new", supplier: "טויוטה", assignee: "", routedTech: true },
      { id: "T-sharon", track: "transport", status: "in_progress", supplier: "טויוטה", assignee: "שרון", routedTech: true },
      { id: "T-other-supplier", track: "transport", status: "new", supplier: "יונגהיינריך", assignee: "", routedTech: true }
    ];
    const driver = { list: vi.fn().mockResolvedValue(tickets), get: vi.fn() };
    const pinSessionClient = pinSessionClientFor({ id: "tech-david", name: "דוד" });
    const token = signCmmsSessionToken("tech-david", "tech", "", "session-secret", Date.now()).token;
    const handler = createTicketsApiHandler({
      driver,
      pinSessionClient,
      env: { CMMS_SESSION_SECRET: "session-secret" }
    });

    const res = await call(handler, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tickets: [tickets[0]] });
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
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "view" } })
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
        status: "pending_manager",
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
      body: { id: "T-2", status: "new", track: "facility", subject: "Worker report", description: "Worker reported an issue", category: "general", priority: "medium" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ticket).toMatchObject({ id: "T-2", status: "pending_manager" });
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({ id: "T-2", status: "pending_manager" }), expect.objectContaining({ actorId: "worker-1" }));
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
    expect(res.json()).toEqual({ error: "ticket_create_fields_required", fields: ["description", "priority", "forkliftId"] });
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

  it("keeps DELETE restricted to admin even when a worker owns the ticket", async () => {
    const ownTicket = ticketRecord({
      id: "T-worker-own-delete",
      reportedBy: { id: "worker-1", name: "Worker A" }
    });
    const driver = {
      get: vi.fn().mockResolvedValue(ownTicket),
      delete: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "worker-1", role: "worker", name: "Worker A" })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer worker-token" },
      query: { id: "T-worker-own-delete" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:tickets:delete" });
    expect(driver.get).toHaveBeenCalledWith("T-worker-own-delete");
    expect(driver.delete).not.toHaveBeenCalled();
  });

  it("blocks worker deletes of tickets outside the worker object scope", async () => {
    const foreignTicket = ticketRecord({
      id: "T-worker-foreign-delete",
      reportedBy: { id: "worker-2", name: "Worker B" }
    });
    const driver = {
      get: vi.fn().mockResolvedValue(foreignTicket),
      delete: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "worker-1", role: "worker", name: "Worker A" })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer worker-token" },
      query: { id: "T-worker-foreign-delete", includeFiles: "1" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:tickets:write_scope" });
    expect(driver.get).toHaveBeenCalledWith("T-worker-foreign-delete");
    expect(driver.delete).not.toHaveBeenCalled();
  });

  it("deletes normalized tickets only for admin sessions", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(ticketRecord({ id: "T-4" })),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createTicketsApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { id: "T-4" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, ticket: { id: "T-4" }, cleanup: { files: 0, metadata: false, errors: 0 } });
    expect(driver.get).toHaveBeenCalledWith("T-4");
    expect(driver.delete).toHaveBeenCalledWith("T-4");
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "admin-1",
      entityType: "ticket",
      entityId: "T-4",
      action: "delete"
    }));
  });

  it("treats a repeated admin delete as an idempotent success", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn()
    };
    const auditDriver = { write: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { id: "T-already-deleted" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      ticket: { id: "T-already-deleted" },
      cleanup: { files: 0, metadata: false, errors: 0 },
      alreadyDeleted: true
    });
    expect(driver.delete).not.toHaveBeenCalled();
    expect(auditDriver.write).not.toHaveBeenCalled();
  });

  it("does not turn a missing ticket into delete access for non-admin roles", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "worker-1", role: "worker" })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer worker-token" },
      query: { id: "T-missing" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:tickets:delete" });
    expect(driver.delete).not.toHaveBeenCalled();
  });

  it("keeps optional file cleanup failures visible without reporting ticket deletion failure", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(ticketRecord({ id: "F-cleanup" })),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const metadataDriver = {
      listActiveByOwner: vi.fn().mockResolvedValue([{ path: "tickets/F-cleanup/before.jpg" }]),
      markDeletedByOwner: vi.fn().mockRejectedValue(new Error("metadata unavailable"))
    };
    const fileDriver = { delete: vi.fn().mockRejectedValue(new Error("storage unavailable")) };
    const handler = createTicketsApiHandler({
      driver,
      metadataDriver,
      fileDriver,
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { id: "F-cleanup" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      ticket: { id: "F-cleanup" },
      cleanup: { files: 0, metadata: false, errors: 2 }
    });
    expect(driver.delete).toHaveBeenCalledWith("F-cleanup");
  });

  it("keeps a successful ticket deletion successful when audit persistence fails", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(ticketRecord({ id: "T-audit-fails" })),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const auditDriver = { write: vi.fn().mockRejectedValue(new Error("audit unavailable")) };
    const handler = createTicketsApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { id: "T-audit-fails" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      ticket: { id: "T-audit-fails" },
      cleanup: { files: 0, metadata: false, errors: 0 },
      audit: { ok: false, error: "audit_write_failed" }
    });
    expect(driver.delete).toHaveBeenCalledWith("T-audit-fails");
    expect(auditDriver.write).toHaveBeenCalled();
  });

  it("reports a mandatory backend delete failure and skips secondary cleanup", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(ticketRecord({ id: "T-delete-fails" })),
      delete: vi.fn().mockRejectedValue(new Error("database unavailable"))
    };
    const metadataDriver = {
      listActiveByOwner: vi.fn(),
      markDeletedByOwner: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      metadataDriver,
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { id: "T-delete-fails" }
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: "tickets_api_error" });
    expect(metadataDriver.listActiveByOwner).not.toHaveBeenCalled();
    expect(metadataDriver.markDeletedByOwner).not.toHaveBeenCalled();
  });

  it("cleans ticket-owned files when deleting a normalized ticket", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(ticketRecord({ id: "T-5" })),
      delete: vi.fn().mockResolvedValue(undefined)
    };
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
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", permissions: { tickets: "manage" } })
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

  it("lets an admin update ticket priority through the dedicated operation and recalculates SLA", async () => {
    const HOUR = 3600000;
    const existing = ticketRecord({
      id: "F-priority-api",
      track: "facility",
      category: "doors",
      priority: "low",
      createdAt: 1000,
      dueAt: 1000 + 72 * HOUR,
      subject: "Original subject",
      status: "in_progress",
      log: [{ at: 1000, by: "Manager", byRole: "user", text: "נפתחה" }]
    });
    const driver = {
      get: vi.fn().mockResolvedValue({ legacy_payload: existing }),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket }))
    };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const configDriver = { get: vi.fn().mockResolvedValue({ config: { catSla: { doors: { high: 4, medium: 24, low: 72 } } } }) };
    const handler = createTicketsApiHandler({
      driver,
      auditDriver,
      configDriver,
      fleetDriver: { list: vi.fn().mockResolvedValue([]) },
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", name: "Vadim", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "priority",
        ticket: { id: "F-priority-api", priority: "high", subject: "Injected subject", status: "cancelled" }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      action: "priority_updated",
      ticket: {
        id: "F-priority-api",
        subject: "Original subject",
        status: "in_progress",
        priority: "high",
        dueAt: 1000 + 4 * HOUR
      }
    });
    const persisted = driver.upsert.mock.calls[0][0];
    expect(persisted).toMatchObject({
      id: "F-priority-api",
      subject: "Original subject",
      status: "in_progress",
      priority: "high",
      dueAt: 1000 + 4 * HOUR
    });
    expect(persisted.log).toHaveLength(2);
    expect(persisted.log[1]).toMatchObject({
      kind: "priority",
      priorityBefore: "low",
      priorityAfter: "high",
      dueAtBefore: 1000 + 72 * HOUR,
      dueAtAfter: 1000 + 4 * HOUR
    });
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "admin-1",
      entityId: "F-priority-api",
      action: "update",
      before: { priority: "low", dueAt: 1000 + 72 * HOUR },
      after: { priority: "high", dueAt: 1000 + 4 * HOUR },
      metadata: expect.objectContaining({ operation: "priority" })
    }));
  });

  it("does not persist or audit an unchanged priority update", async () => {
    const existing = ticketRecord({ id: "F-priority-same", priority: "medium", createdAt: 1000, dueAt: 2000 });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn()
    };
    const auditDriver = { write: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      auditDriver,
      configDriver: { get: vi.fn().mockResolvedValue({ config: {} }) },
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { operation: "priority", ticket: { id: "F-priority-same", priority: "medium" } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, action: "unchanged", ticket: { id: "F-priority-same", priority: "medium" } });
    expect(driver.upsert).not.toHaveBeenCalled();
    expect(auditDriver.write).not.toHaveBeenCalled();
  });

  it("rejects generic priority updates for transport tickets", async () => {
    const existing = ticketRecord({
      id: "T-priority-unsupported",
      track: "transport",
      forkliftId: "forklift-210",
      category: "transport",
      priority: "high",
      downtimeType: "critical",
      createdAt: 1000,
      dueAt: 2000
    });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn()
    };
    const auditDriver = { write: vi.fn() };
    const handler = createTicketsApiHandler({
      driver,
      auditDriver,
      configDriver: { get: vi.fn().mockResolvedValue({ config: {} }) },
      fleetDriver: { list: vi.fn().mockResolvedValue([]) },
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", name: "Vadim", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { operation: "priority", ticket: { id: "T-priority-unsupported", priority: "low" } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "ticket_priority_update_unsupported_track" });
    expect(driver.upsert).not.toHaveBeenCalled();
    expect(auditDriver.write).not.toHaveBeenCalled();
  });

  it("lets an admin update transport downtime type through the dedicated operation and recalculates SLA", async () => {
    const HOUR = 3600000;
    const existing = ticketRecord({
      id: "T-downtime-api",
      track: "transport",
      category: "transport",
      forkliftId: "forklift-210",
      downtimeType: "minor",
      priority: "low",
      createdAt: 1000,
      dueAt: 1000 + 72 * HOUR,
      subject: "Original subject",
      status: "in_progress",
      log: [{ at: 1000, by: "Manager", byRole: "user", text: "נפתחה" }]
    });
    const driver = {
      get: vi.fn().mockResolvedValue({ legacy_payload: existing }),
      upsert: vi.fn().mockImplementation(async (ticket) => ({ legacy_payload: ticket }))
    };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const configDriver = { get: vi.fn().mockResolvedValue({ config: { downtimeLevels: [
      { id: "minor", label: "תקלה לטיפול או בדיקה", prio: "low", color: "#16A34A" },
      { id: "critical", label: "תקלה קריטית - אין גיבוי", prio: "high", color: "#DC2626", oos: true }
    ] } }) };
    const handler = createTicketsApiHandler({
      driver,
      auditDriver,
      configDriver,
      fleetDriver: { list: vi.fn().mockResolvedValue([]) },
      sessionClient: sessionClientFor({ id: "admin-1", role: "admin", name: "Vadim", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        operation: "downtime",
        ticket: { id: "T-downtime-api", downtimeType: "critical", subject: "Injected subject", status: "cancelled" }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      action: "downtime_updated",
      ticket: {
        id: "T-downtime-api",
        subject: "Original subject",
        status: "in_progress",
        downtimeType: "critical",
        priority: "high",
        dueAt: 1000 + 4 * HOUR
      }
    });
    const persisted = driver.upsert.mock.calls[0][0];
    expect(persisted).toMatchObject({
      id: "T-downtime-api",
      subject: "Original subject",
      status: "in_progress",
      downtimeType: "critical",
      priority: "high",
      dueAt: 1000 + 4 * HOUR
    });
    expect(persisted.log.at(-1)).toMatchObject({
      kind: "downtime_type",
      downtimeTypeBefore: "minor",
      downtimeTypeAfter: "critical",
      priorityBefore: "low",
      priorityAfter: "high"
    });
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "admin-1",
      entityId: "T-downtime-api",
      action: "update",
      before: { downtimeType: "minor", priority: "low", dueAt: 1000 + 72 * HOUR },
      after: { downtimeType: "critical", priority: "high", dueAt: 1000 + 4 * HOUR },
      metadata: expect.objectContaining({ operation: "downtime" })
    }));
  });

  it("rejects system-only transport downtime values", async () => {
    const handler = createTicketsApiHandler({
      driver: {
        get: vi.fn().mockResolvedValue(ticketRecord({ id: "T-downtime-invalid", track: "transport", forkliftId: "forklift-210", downtimeType: "minor", priority: "low" })),
        upsert: vi.fn()
      },
      configDriver: { get: vi.fn().mockResolvedValue({ config: {} }) },
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { operation: "downtime", ticket: { id: "T-downtime-invalid", downtimeType: "needs_triage" } }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "ticket_downtime_update_invalid" });
  });

  it("rejects downtime type changes through the generic update operation", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(ticketRecord({ id: "T-downtime-generic", track: "transport", forkliftId: "forklift-210", downtimeType: "minor", priority: "low", status: "new" })),
      upsert: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { operation: "update", ticket: { id: "T-downtime-generic", downtimeType: "critical", priority: "low", status: "new" } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "ticket_downtime_update_requires_downtime_operation" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["technician", pinSessionClientFor({ role: "tech", name: "שרון", supplier: "טויוטה" }), null, "Bearer cmms-token"],
    ["ordinary manager", null, sessionClientFor({ role: "user", permissions: { tickets: "manage" } }), "Bearer user-token"],
    ["supplier user", null, sessionClientFor({ role: "supplier", permissions: { tickets: "manage" } }), "Bearer user-token"]
  ])("rejects %s priority updates", async (_label, pinSessionClient, sessionClient, authorization) => {
    const existing = ticketRecord({ id: "F-priority-forbidden", priority: "medium", createdAt: 1000, dueAt: 2000 });
    const driver = {
      get: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      configDriver: { get: vi.fn().mockResolvedValue({ config: {} }) },
      sessionClient,
      pinSessionClient,
      env: { CMMS_SESSION_SECRET: "secret" }
    });
    const token = authorization.includes("cmms-token")
      ? `Bearer ${signCmmsSessionToken("tech-sharon", "tech", "", "secret").token}`
      : authorization;

    const res = await call(handler, {
      headers: { authorization: token },
      body: { operation: "priority", ticket: { id: "F-priority-forbidden", priority: "high" } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "ticket_priority_update_forbidden" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });

  it("rejects invalid priority values", async () => {
    const handler = createTicketsApiHandler({
      driver: {
        get: vi.fn().mockResolvedValue(ticketRecord({ id: "F-priority-invalid", priority: "medium" })),
        upsert: vi.fn()
      },
      configDriver: { get: vi.fn().mockResolvedValue({ config: {} }) },
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { operation: "priority", ticket: { id: "F-priority-invalid", priority: "critical" } }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "ticket_priority_invalid" });
  });

  it("rejects priority changes through the generic update operation", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(ticketRecord({ id: "F-priority-generic", priority: "medium", status: "new" })),
      upsert: vi.fn()
    };
    const handler = createTicketsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "admin", permissions: { tickets: "manage" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { operation: "update", ticket: { id: "F-priority-generic", priority: "high", status: "new" } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "ticket_priority_update_requires_priority_operation" });
    expect(driver.upsert).not.toHaveBeenCalled();
  });
});
