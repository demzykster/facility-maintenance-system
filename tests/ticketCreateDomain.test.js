import { describe, expect, it, vi } from "vitest";
import {
  canonicalTicketCreateHash,
  createTicketReplayResult,
  createTicketRecord,
  mergeTicketUpdateWithExisting,
  sanitizeTicketCreatePayload
} from "../server/tickets/ticketCreateDomain.js";

describe("ticket create domain", () => {
  it("ignores client num on create and returns persisted id/number as authoritative result", async () => {
    const driver = {
      create: vi.fn().mockResolvedValue({
        ticketId: "ticket-1",
        num: 1842,
        ticketNo: "T-1842",
        status: "new",
        idempotencyStatus: "created"
      })
    };

    const result = await createTicketRecord({
      driver,
      actor: { id: "u1", role: "user" },
      ticket: {
        id: "ticket-1",
        num: 99,
        track: "transport",
        forkliftId: "226",
        subject: "Fan",
        description: "Fan stopped",
        category: "transport",
        priority: "medium",
        downtimeType: "needs_triage"
      },
      idempotencyKey: "idem-1"
    });

    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({ id: "ticket-1", num: null }), expect.objectContaining({
      actorId: "u1",
      idempotencyKey: "idem-1",
      requestHash: expect.any(String)
    }));
    expect(result.ticket).toMatchObject({ id: "ticket-1", num: 1842, ticketNo: "T-1842" });
    expect(result.result).toMatchObject({ type: "ticket.create", ticketId: "ticket-1", num: 1842, ticketNumber: "T-1842", ticketNo: "T-1842" });
  });

  it("scrubs client-supplied system and actor fields before create hashing and persistence", async () => {
    const actor = { id: "u1", name: "Manager", role: "user", dept: "Ops" };
    const driver = {
      create: vi.fn().mockResolvedValue({
        ticketId: "ticket-1",
        num: 6,
        ticketNo: "F-006",
        status: "new",
        idempotencyStatus: "created"
      })
    };

    const result = await createTicketRecord({
      driver,
      actor,
      ticket: {
        id: "ticket-1",
        num: 999,
        ticketNo: "F-999",
        ticketNumber: "F-999",
        status: "done",
        createdAt: 1,
        updatedAt: 2,
        closedAt: 3,
        created_at: "2000-01-01T00:00:00Z",
        updated_at: "2000-01-02T00:00:00Z",
        closed_at: "2000-01-03T00:00:00Z",
        sourceKvKey: "ticket:attacker",
        source_kv_key: "ticket:attacker",
        actor_id: "attacker",
        actorId: "attacker",
        createdBy: { id: "attacker", name: "Attacker", role: "admin" },
        reportedBy: { id: "attacker", name: "Attacker", role: "admin" },
        reportedById: "attacker",
        track: "facility",
        subject: "Door",
        description: "Door is stuck",
        category: "doors",
        priority: "medium"
      },
      idempotencyKey: "idem-1"
    });

    const persistedTicket = driver.create.mock.calls[0][0];
    expect(persistedTicket).toMatchObject({
      id: "ticket-1",
      num: null,
      status: "new",
      department: "Ops",
      createdBy: { id: "u1", name: "Manager", role: "user" },
      reportedBy: { id: "u1", name: "Manager", role: "user" }
    });
    expect(persistedTicket.ticketNo).toBeUndefined();
    expect(persistedTicket.ticketNumber).toBeUndefined();
    expect(persistedTicket.createdAt).toBeUndefined();
    expect(persistedTicket.updatedAt).toBeUndefined();
    expect(persistedTicket.closedAt).toBeUndefined();
    expect(persistedTicket.actor_id).toBeUndefined();
    expect(persistedTicket.actorId).toBeUndefined();
    expect(persistedTicket.reportedById).toBeUndefined();
    expect(driver.create.mock.calls[0][1]).toMatchObject({
      actorId: "u1",
      idempotencyKey: "idem-1",
      requestHash: canonicalTicketCreateHash(sanitizeTicketCreatePayload({
        id: "ticket-1",
        status: "done",
        track: "facility",
        subject: "Door",
        description: "Door is stuck",
        category: "doors",
        priority: "medium"
      }, actor), actor)
    });
    expect(result.ticket).toMatchObject({
      id: "ticket-1",
      num: 6,
      ticketNo: "F-006",
      sourceKvKey: "ticket:ticket-1",
      status: "new",
      reportedBy: { id: "u1" }
    });
  });

  it("normalizes worker-created tickets into manager intake and strips routing fields", async () => {
    const actor = { id: "worker-1", name: "Worker", role: "worker", dept: "Ops" };
    const driver = {
      create: vi.fn().mockResolvedValue({
        ticketId: "ticket-worker-1",
        num: 12,
        ticketNo: "F-012",
        status: "pending_manager",
        idempotencyStatus: "created"
      })
    };

    const result = await createTicketRecord({
      driver,
      actor,
      ticket: {
        id: "ticket-worker-1",
        track: "facility",
        subject: "Leak",
        description: "Leak near dock",
        priority: "medium",
        status: "done",
        assignee: "Attacker",
        supplier: "Toyota",
        routedTech: true,
        mgrExec: true,
        waitingReason: "supplier",
        waitingSupplier: "Vendor",
        dueAt: 123456,
        approvedAt: 123
      },
      idempotencyKey: "idem-worker-1"
    });

    const persistedTicket = driver.create.mock.calls[0][0];
    expect(persistedTicket).toMatchObject({
      id: "ticket-worker-1",
      status: "pending_manager",
      department: "Ops",
      createdBy: { id: "worker-1", name: "Worker", role: "worker" },
      reportedBy: { id: "worker-1", name: "Worker", role: "worker" }
    });
    expect(persistedTicket.assignee).toBeUndefined();
    expect(persistedTicket.supplier).toBeUndefined();
    expect(persistedTicket.routedTech).toBeUndefined();
    expect(persistedTicket.mgrExec).toBeUndefined();
    expect(persistedTicket.waitingReason).toBeUndefined();
    expect(persistedTicket.waitingSupplier).toBeUndefined();
    expect(persistedTicket.dueAt).toBeUndefined();
    expect(persistedTicket.approvedAt).toBeUndefined();
    expect(result.ticket).toMatchObject({ id: "ticket-worker-1", status: "pending_manager" });
  });

  it("allows worker intake before final facility category classification", async () => {
    const driver = {
      create: vi.fn().mockResolvedValue({
        ticketId: "ticket-worker-facility",
        num: 13,
        ticketNo: "F-013",
        status: "pending_manager",
        idempotencyStatus: "created"
      })
    };

    await expect(createTicketRecord({
      driver,
      actor: { id: "worker-1", name: "Worker", role: "worker" },
      ticket: {
        id: "ticket-worker-facility",
        track: "facility",
        subject: "Door",
        description: "Door is stuck",
        priority: "medium"
      }
    })).resolves.toMatchObject({ ticket: { status: "pending_manager" } });
  });

  it("allows worker transport intake before downtime classification but still requires an asset", async () => {
    const driver = { create: vi.fn() };

    await expect(createTicketRecord({
      driver,
      actor: { id: "worker-1", name: "Worker", role: "worker" },
      ticket: {
        id: "ticket-worker-transport",
        track: "transport",
        subject: "Noise",
        description: "Noise while turning",
        priority: "medium"
      }
    })).rejects.toThrow("ticket_create_fields_required:forkliftId");
  });

  it("uses replayed authoritative id/number for both action result and returned ticket payload", async () => {
    const driver = {
      create: vi.fn().mockResolvedValue({
        ticketId: "persisted-ticket",
        num: 1842,
        ticketNumber: "T-1842",
        status: "new",
        idempotencyStatus: "replayed"
      })
    };

    const result = await createTicketRecord({
      driver,
      actor: { id: "u1", role: "user" },
      ticket: {
        id: "retry-generated-ticket",
        track: "transport",
        forkliftId: "226",
        subject: "Fan",
        description: "Fan stopped",
        category: "transport",
        priority: "medium",
        downtimeType: "needs_triage"
      },
      idempotencyKey: "idem-1"
    });

    expect(result.ticket).toMatchObject({
      id: "persisted-ticket",
      num: 1842,
      ticketNo: "T-1842",
      sourceKvKey: "ticket:persisted-ticket"
    });
    expect(result.result).toMatchObject({
      ticketId: "persisted-ticket",
      ticketNumber: "T-1842",
      idempotencyStatus: "replayed"
    });
  });

  it("requires DB/RPC authoritative numbering instead of server-side fallback formatting", async () => {
    const driver = {
      create: vi.fn().mockResolvedValue({
        ticketId: "ticket-1",
        num: 1842,
        status: "new",
        idempotencyStatus: "created"
      })
    };

    await expect(createTicketRecord({
      driver,
      actor: { id: "u1", role: "user" },
      ticket: {
        id: "ticket-1",
        track: "transport",
        forkliftId: "226",
        subject: "Fan",
        description: "Fan stopped",
        category: "transport",
        priority: "medium",
        downtimeType: "needs_triage"
      },
      idempotencyKey: "idem-1"
    })).rejects.toThrow("authoritative_ticket_number_required");
  });

  it("enforces the shared create contract before persistence", async () => {
    const driver = { create: vi.fn() };

    await expect(createTicketRecord({
      driver,
      actor: { id: "u1", role: "user" },
      ticket: {
        id: "ticket-1",
        track: "transport",
        subject: "Fan",
        category: "transport",
        priority: "medium",
        downtimeType: "needs_triage"
      }
    })).rejects.toThrow("ticket_create_fields_required:description,forkliftId");
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("detects same idempotency key with different payload through the canonical request hash", () => {
    const actor = { id: "u1", role: "user" };
    const base = {
      track: "transport",
      forkliftId: "226",
      subject: "Не работает вентилятор",
      description: "Не работает вентилятор на машине 226",
      category: "transport",
      priority: "medium",
      downtimeType: "needs_triage"
    };

    expect(canonicalTicketCreateHash(base, actor)).toBe(canonicalTicketCreateHash({ ...base, id: "ticket-2", num: 999 }, actor));
    expect(canonicalTicketCreateHash(base, actor)).not.toBe(canonicalTicketCreateHash({ ...base, subject: "Машина не едет" }, actor));
  });

  it("treats changes to forbidden system fields as the same create request", () => {
    const actor = { id: "u1", role: "user" };
    const base = {
      id: "ticket-1",
      track: "facility",
      subject: "Door",
      description: "Door is stuck",
      category: "doors"
    };

    expect(canonicalTicketCreateHash(sanitizeTicketCreatePayload(base, actor), actor)).toBe(canonicalTicketCreateHash(sanitizeTicketCreatePayload({
      ...base,
      num: 999,
      ticketNo: "F-999",
      ticketNumber: "F-999",
      status: "done",
      createdAt: 1,
      updatedAt: 2,
      sourceKvKey: "ticket:attacker",
      actor_id: "attacker",
      reportedBy: { id: "attacker" }
    }, actor), actor));
  });

  it("recognizes an existing ticket as a replayed create only when create content matches", () => {
    const actor = { id: "u1", role: "user" };
    const base = {
      id: "ticket-1",
      num: 7,
      ticketNo: "F-007",
      track: "facility",
      subject: "Door",
      description: "Door is stuck",
      category: "doors",
      status: "new"
    };

    expect(createTicketReplayResult({
      ticket: { ...base, num: 99 },
      existing: { legacy_payload: base },
      actor
    })).toMatchObject({
      replay: true,
      ticket: { id: "ticket-1", num: 7 },
      result: {
        type: "ticket.create",
        ticketId: "ticket-1",
        num: 7,
        ticketNo: "F-007",
        idempotencyStatus: "replayed"
      }
    });

    expect(createTicketReplayResult({
      ticket: { ...base, subject: "Window" },
      existing: { legacy_payload: base },
      actor
    })).toMatchObject({ replay: false });
  });

  it("preserves existing num for update and does not allocate a new one", () => {
    expect(mergeTicketUpdateWithExisting({ id: "ticket-1", num: 99, status: "open" }, { id: "ticket-1", num: 7 }))
      .toMatchObject({ id: "ticket-1", num: 7, status: "open" });
  });
});
