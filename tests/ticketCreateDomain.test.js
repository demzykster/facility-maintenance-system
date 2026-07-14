import { describe, expect, it, vi } from "vitest";
import {
  canonicalTicketCreateHash,
  createTicketRecord,
  mergeTicketUpdateWithExisting
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

  it("preserves existing num for update and does not allocate a new one", () => {
    expect(mergeTicketUpdateWithExisting({ id: "ticket-1", num: 99, status: "open" }, { id: "ticket-1", num: 7 }))
      .toMatchObject({ id: "ticket-1", num: 7, status: "open" });
  });
});
