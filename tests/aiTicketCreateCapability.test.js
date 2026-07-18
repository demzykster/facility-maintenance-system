import { describe, expect, it, vi } from "vitest";
import { createTicketCreateCapability } from "../server/ai/capabilities/ticketCreateCapability.js";

const user = { id: "u1", role: "user", name: "Vadim", department: "Ops" };
const fleet226 = { id: "forklift-226", code: "226", supplier: "LiftCo", department: "Ops", status: "active" };

function capability(driver = null) {
  return createTicketCreateCapability({ driver });
}

async function execute(text, options = {}) {
  const driver = options.driver || {
    create: vi.fn().mockResolvedValue({
      ticketId: "ticket-226",
      num: 1842,
      ticketNo: "T-1842",
      status: "new",
      idempotencyStatus: options.replayed ? "replayed" : "created"
    })
  };
  const result = await capability(driver).execute({
    text,
    idempotencyKey: options.idempotencyKey || "idem-1"
  }, {
    user: options.user || user,
    context: options.context || { fleet: [fleet226], tickets: options.tickets || [] },
    rawContext: options.rawContext || {},
    text,
    now: 1000
  });
  return { result, driver };
}

describe("AI ticket.create capability", () => {
  it("creates a simple transport ticket without extra duplicate lookup or diagnosis", async () => {
    const { result, driver } = await execute("Не работает вентилятор на машине 226");

    expect(result.executionStatus).toBe("created");
    expect(result.answer).toBe("Создал заявку T-1842 по машине 226: Не работает вентилятор");
    expect(result.actionResult).toMatchObject({ type: "ticket.create", ticketId: "ticket-226", ticketNumber: "T-1842", ticketNo: "T-1842" });
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({
      track: "transport",
      asset: "226",
      forkliftId: "forklift-226",
      subject: "Не работает вентилятор",
      description: "Не работает вентилятор на машине 226",
      downtimeType: "needs_triage",
      priority: "medium",
      department: "Ops",
      dueAt: 1000 + 24 * 3600000
    }), expect.objectContaining({ idempotencyKey: "idem-1" }));
    expect(result.toolResults.map((tool) => tool.capability)).toEqual([
      "get_current_user_context",
      "find_asset_by_visible_identifier",
      "get_ticket_create_contract"
    ]);
    expect(JSON.stringify(driver.create.mock.calls[0][0])).not.toMatch(/мотор|ремень|перегрев/i);
  });

  it("looks up open tickets only for recurrence wording and still blocks dangerous safety cases", async () => {
    const { result, driver } = await execute("На 226 снова не работают тормоза", {
      tickets: [{ id: "old-1", forkliftId: "forklift-226", status: "new", subject: "Тормоза" }]
    });

    expect(result.executionStatus).toBe("blocked");
    expect(result.blockingQuestion).toContain("בטיחות");
    expect(result.toolResults.map((tool) => tool.capability)).toContain("get_open_tickets_for_asset");
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("blocks safety-risk phrases instead of silently applying needs_triage", async () => {
    for (const text of ["Машина 226 не едет", "Из машины 226 идет дым", "Искрение на 226", "Отказ тормозов на 226"]) {
      const { result, driver } = await execute(text);
      expect(result.executionStatus).toBe("blocked");
      expect(result.unknowns).toContain("safe_downtime_state");
      expect(driver.create).not.toHaveBeenCalled();
    }
  });

  it("asks one blocking question when asset information is missing, unknown, ambiguous, or typoed", async () => {
    expect((await execute("Проблема с машиной")).result).toMatchObject({
      executionStatus: "blocked",
      unknowns: ["asset"]
    });
    expect((await execute("Не работает вентилятор на машине 999")).result).toMatchObject({
      executionStatus: "blocked",
      unknowns: ["asset"]
    });
    expect((await execute("Не работает вентилятор на машине 2266")).result).toMatchObject({
      executionStatus: "blocked",
      unknowns: ["asset"]
    });
    expect((await execute("Не работает вентилятор на машине 226", {
      context: { fleet: [{ ...fleet226, id: "a" }, { ...fleet226, id: "b" }], tickets: [] }
    })).result).toMatchObject({
      executionStatus: "blocked",
      unknowns: ["asset"]
    });
  });

  it("uses the current route asset only after matching it to the server-filtered fleet", async () => {
    const { result, driver } = await execute("Не работает вентилятор", {
      context: { fleet: [fleet226], tickets: [] },
      rawContext: { currentEntity: fleet226 }
    });

    expect(result.executionStatus).toBe("created");
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({ forkliftId: "forklift-226", asset: "226" }), expect.any(Object));
  });

  it("blocks spoofed route assets that are absent from the server-filtered fleet", async () => {
    const { result, driver } = await execute("Не работает вентилятор", {
      context: { fleet: [], tickets: [] },
      rawContext: { currentEntity: fleet226 }
    });

    expect(result.executionStatus).toBe("blocked");
    expect(result.unknowns).toContain("asset");
    expect(driver.create).not.toHaveBeenCalled();
  });

  it.each([
    ["worker", { id: "worker-a", role: "worker", name: "Worker A", department: "Ops" }],
    ["user", { id: "user-a", role: "user", name: "User A", department: "Ops", departments: ["Ops"] }],
    ["tech", { id: "tech-a", role: "tech", name: "Tech A", department: "Ops", departments: ["Ops"] }]
  ])("blocks %s autonomous create for assets outside the filtered fleet", async (_role, scopedUser) => {
    const outsideAsset = { id: "forklift-999", code: "999", supplier: "OtherCo", department: "Other", status: "active" };
    const { result, driver } = await execute("Не работает вентилятор", {
      user: scopedUser,
      context: { fleet: [fleet226], tickets: [] },
      rawContext: { currentEntity: outsideAsset }
    });

    expect(result.executionStatus).toBe("blocked");
    expect(result.unknowns).toContain("asset");
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("does not allow a matching visible name/code to override a spoofed currentEntity id", async () => {
    const { result, driver } = await execute("Не работает вентилятор", {
      context: { fleet: [fleet226], tickets: [] },
      rawContext: { currentEntity: { id: "forklift-999", code: "226", name: "226" } }
    });

    expect(result.executionStatus).toBe("blocked");
    expect(result.unknowns).toContain("asset");
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("lets admin create for an asset visible in admin filtered context", async () => {
    const admin = { id: "admin-1", role: "admin", name: "Admin" };
    const { result, driver } = await execute("Не работает вентилятор", {
      user: admin,
      context: { fleet: [fleet226], tickets: [] },
      rawContext: { currentEntity: fleet226 }
    });

    expect(result.executionStatus).toBe("created");
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({
      createdBy: expect.objectContaining({ id: "admin-1", role: "admin" }),
      forkliftId: "forklift-226"
    }), expect.objectContaining({ actorId: "admin-1" }));
  });

  it("takes actor and system fields from the authenticated session and server payload only", async () => {
    const maliciousRawContext = {
      currentEntity: fleet226,
      ticket: {
        id: "client-ticket-id",
        num: 999,
        ticketNo: "F-999",
        status: "done",
        actor_id: "attacker",
        reportedBy: { id: "attacker" },
        createdBy: { id: "attacker" },
        ai: { source: "client" }
      }
    };
    const { result, driver } = await execute("Не работает вентилятор", {
      context: { fleet: [fleet226], tickets: [] },
      rawContext: maliciousRawContext
    });

    expect(result.executionStatus).toBe("created");
    const [ticket, options] = driver.create.mock.calls[0];
    expect(ticket.id).toMatch(/^ticket-/);
    expect(ticket.id).not.toBe("client-ticket-id");
    expect(ticket.num).toBeNull();
    expect(ticket.ticketNo).toBeUndefined();
    expect(ticket.status).toBe("new");
    expect(ticket.createdBy).toMatchObject({ id: "u1", role: "user" });
    expect(ticket.reportedBy).toMatchObject({ id: "u1", role: "user" });
    expect(ticket.actor_id).toBeUndefined();
    expect(ticket.ai).toMatchObject({ source: "ai_capability", autonomous: true, capability: "create_ticket" });
    expect(options).toMatchObject({ actorId: "u1" });
  });

  it("denies users who cannot create tickets", async () => {
    const { result, driver } = await execute("Не работает вентилятор на машине 226", {
      user: { id: "cleaner-1", role: "cleaner", name: "Cleaner" }
    });

    expect(result.executionStatus).toBe("permission_denied");
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("replays the same idempotency result without creating a second semantic response", async () => {
    const { result } = await execute("Не работает вентилятор на машине 226", { replayed: true });

    expect(result.executionStatus).toBe("replayed");
    expect(result.answer).toContain("T-1842");
  });

  it("returns failed when the create capability cannot persist or idempotency conflicts", async () => {
    const conflict = { create: vi.fn().mockRejectedValue(new Error("idempotency_conflict")) };
    expect((await execute("Не работает вентилятор на машине 226", { driver: conflict })).result).toMatchObject({
      executionStatus: "failed",
      unknowns: ["idempotency_conflict"]
    });

    const failure = { create: vi.fn().mockRejectedValue(new Error("boom")) };
    expect((await execute("Не работает вентилятор на машине 226", { driver: failure })).result).toMatchObject({
      executionStatus: "failed",
      unknowns: ["create_failed"]
    });
  });
});
