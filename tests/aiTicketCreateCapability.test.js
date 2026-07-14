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

  it("uses the current route asset when the user does not repeat the number", async () => {
    const { result, driver } = await execute("Не работает вентилятор", {
      context: { fleet: [], tickets: [] },
      rawContext: { currentEntity: fleet226 }
    });

    expect(result.executionStatus).toBe("created");
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({ forkliftId: "forklift-226", asset: "226" }), expect.any(Object));
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
