import { describe, expect, it, vi } from "vitest";
import { createTicketCreateCapability } from "../server/ai/capabilities/ticketCreateCapability.js";

const autonomyPermission = { aiAutonomousTicketCreate: "request" };
const user = { id: "u1", role: "user", name: "Vadim", department: "Ops", permissions: autonomyPermission };
const fleet226 = { id: "forklift-226", code: "226", supplier: "LiftCo", department: "Ops", status: "active" };
const defaultConfig = {
  categories: [{ id: "hvac", label: "מיזוג אוויר" }, { id: "building", label: "בניין" }, { id: "other", label: "אחר" }],
  zones: ["משרדי הפצה", "מחסן ראשי", "משרדי הנהלה"]
};

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
    fullVisibleFleet: options.fullVisibleFleet || [],
    rawContext: options.rawContext || { uiSurface: "inline_ticket_create", taskSession: { type: "ticket_intake", transient: true } },
    text,
    latestText: options.latestText || text,
    intake: options.intake || null,
    config: options.config || defaultConfig,
    module: options.module || "transport",
    workflow: options.workflow || "ticket_intake",
    now: 1000
  });
  return { result, driver };
}

describe("AI ticket.create capability", () => {
  it("creates a simple transport ticket without extra duplicate lookup or diagnosis", async () => {
    const { result, driver } = await execute("Не работает вентилятор на машине 226");

    expect(result.executionStatus).toBe("created");
    expect(result.answer).toContain("נפתחה קריאה T-1842");
    expect(result.actionResult).toMatchObject({ type: "ticket.create", ticketId: "ticket-226", ticketNumber: "T-1842", ticketNo: "T-1842", track: "transport" });
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({
      track: "transport",
      asset: "226",
      forkliftId: "forklift-226",
      subject: "Не работает вентилятор на машине 226",
      description: "Не работает вентилятор на машине 226",
      downtimeType: "needs_triage",
      priority: "medium",
      department: "Ops",
      dueAt: 1000 + 24 * 3600000
    }), expect.objectContaining({ idempotencyKey: "idem-1" }));
    expect(result.toolResults.map((tool) => tool.capability)).toEqual([
      "get_current_user_context",
      "get_ticket_create_contract",
      "resolve_inline_ticket_intake"
    ]);
    expect(JSON.stringify(driver.create.mock.calls[0][0])).not.toMatch(/мотор|ремень|перегрев/i);
  });

  it("resolves a visible display number beyond the compact provider fleet snapshot", async () => {
    const compactFleet = Array.from({ length: 18 }, (_, index) => ({
      id: `visible-${index + 1}`,
      code: String(100 + index),
      department: "Ops"
    }));
    const fullVisibleFleet = [
      ...compactFleet,
      { id: "forklift-210", code: "210", supplier: "LiftCo", department: "Ops", status: "active" }
    ];

    const { result, driver } = await execute("במלגזה 210 הגלגלים שבורים", {
      context: { fleet: compactFleet, tickets: [] },
      fullVisibleFleet
    });

    expect(result.executionStatus).toBe("created");
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({
      track: "transport",
      asset: "210",
      forkliftId: "forklift-210",
      description: "במלגזה 210 הגלגלים שבורים"
    }), expect.any(Object));
  });

  it("locks transport when a visible asset and transport entity are deterministic even if provider/module says facility", async () => {
    const { result, driver } = await execute("במלגזה 210 ראש קילש לא עובד", {
      module: "facility",
      context: { fleet: [{ id: "forklift-210", code: "210", type: "מלגזה", department: "Ops" }], tickets: [] }
    });

    expect(result.executionStatus).toBe("created");
    expect(result.actionResult).toMatchObject({ track: "transport", forkliftId: "forklift-210", asset: "210" });
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({
      track: "transport",
      description: "במלגזה 210 ראש קילש לא עובד",
      priority: "medium"
    }), expect.any(Object));
  });

  it("asks only for the transport asset number when a forklift problem omits it", async () => {
    const { result, driver } = await execute("הגלגלים במלגזה שבורים", {
      context: { fleet: [{ id: "forklift-210", code: "210", type: "מלגזה", department: "Ops" }], tickets: [] }
    });

    expect(result.executionStatus).toBe("blocked");
    expect(result.blockingQuestion).toBe("מה מספר המלגזה?");
    expect(result.intake).toMatchObject({ domain: "transport", pendingField: "asset" });
    expect(result.blockingQuestion).not.toContain("אזור");
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("does not default unresolved ticket-intake text to facility", async () => {
    const { result, driver } = await execute("יש תקלה", { module: "unknown" });

    expect(result.executionStatus).toBe("blocked");
    expect(result.unknowns).toContain("domain");
    expect(result.blockingQuestion).toContain("כלי שינוע");
    expect(result.intake).toMatchObject({ domain: "unresolved", pendingField: "domain" });
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("does not grant general AI chat automatic ticket-create authority", async () => {
    const { result, driver } = await execute("פתח קריאה במלגזה 226", {
      workflow: "general",
      rawContext: {},
      context: { fleet: [fleet226], tickets: [] }
    });

    expect(result.executionStatus).toBe("feature_disabled");
    expect(result.unknowns).toContain("workflow");
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("matches numeric and alias-like asset identifiers only inside visible fleet", async () => {
    const visibleAlias = { id: "forklift-a", vehicleNumber: 210, department: "Ops", status: "active" };
    const { result, driver } = await execute("Forklift 210 not working", {
      context: { fleet: [], tickets: [] },
      fullVisibleFleet: [visibleAlias]
    });

    expect(result.executionStatus).toBe("created");
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({
      forkliftId: "forklift-a",
      asset: "210"
    }), expect.any(Object));

    const blocked = await execute("Forklift 210 not working", {
      context: { fleet: [], tickets: [] },
      fullVisibleFleet: []
    });
    expect(blocked.result.executionStatus).toBe("blocked");
    expect(blocked.driver.create).not.toHaveBeenCalled();
  });

  it("keeps facility intake in chat until a canonical location is supplied", async () => {
    const { result, driver } = await execute("מזגן לא עובד בחדר מפעיל מערכת", {
      module: "facility",
      config: defaultConfig
    });

    expect(result.executionStatus).toBe("blocked");
    expect(result.unknowns).toContain("location");
    expect(result.blockingQuestion).toBe("באיזה אזור או מחלקה נמצא חדר מפעיל המערכת?");
    expect(result.intake).toMatchObject({
      domain: "facility",
      pendingField: "location",
      draft: {
        track: "facility",
        category: "hvac",
        categoryLabel: "מיזוג אוויר",
        priority: "medium",
        zone: ""
      }
    });
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("creates a facility ticket from the follow-up location without opening the normal form", async () => {
    const pending = {
      domain: "facility",
      status: "collecting",
      pendingField: "location",
      originalMessage: "מזגן לא עובד בחדר מפעיל מערכת",
      draft: {
        track: "facility",
        subject: "מזגן לא עובד בחדר מפעיל מערכת",
        description: "דווח כי המזגן בחדר מפעיל המערכת אינו עובד. יש לבדוק את התקלה.",
        category: "hvac",
        categoryLabel: "מיזוג אוויר",
        priority: "medium",
        zone: ""
      }
    };
    const { result, driver } = await execute("מזגן לא עובד בחדר מפעיל מערכת. באזור משרדי הפצה", {
      latestText: "משרדי הפצה",
      intake: pending,
      module: "facility",
      config: defaultConfig
    });

    expect(result.executionStatus).toBe("created");
    expect(result.answer).toContain("נפתחה קריאה T-1842");
    expect(result.answer).toContain("סוג: אחזקת מבנה ומתקנים");
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({
      track: "facility",
      category: "hvac",
      categoryLabel: "מיזוג אוויר",
      zone: "משרדי הפצה",
      priority: "medium",
      subject: "מזגן לא עובד בחדר מפעיל מערכת",
      description: expect.stringContaining("המזגן")
    }), expect.any(Object));
    expect(driver.create.mock.calls[0][0].description).not.toBe(driver.create.mock.calls[0][0].subject);
  });

  it("does not guess reception or high priority for facility intake without explicit evidence", async () => {
    const { result, driver } = await execute("מזגן לא עובד בחדר מפעיל מערכת", {
      module: "facility",
      config: { ...defaultConfig, zones: ["קבלה", "משרדי הפצה"] }
    });

    expect(result.executionStatus).toBe("blocked");
    expect(result.intake.draft).toMatchObject({
      category: "hvac",
      priority: "medium",
      zone: ""
    });
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("does not create a facility ticket for unknown or ambiguous locations", async () => {
    const unknown = await execute("מזגן לא עובד בחדר מפעיל מערכת. באזור מקום לא קיים", {
      module: "facility",
      config: defaultConfig
    });
    expect(unknown.result.executionStatus).toBe("blocked");
    expect(unknown.result.unknowns).toContain("location");
    expect(unknown.driver.create).not.toHaveBeenCalled();

    const ambiguous = await execute("מזגן לא עובד במשרדי", {
      module: "facility",
      config: { ...defaultConfig, zones: ["משרדי הפצה", "משרדי הנהלה"] }
    });
    expect(ambiguous.result.executionStatus).toBe("blocked");
    expect(ambiguous.result.blockingQuestion).toContain("מצאתי כמה מיקומים");
    expect(ambiguous.driver.create).not.toHaveBeenCalled();
  });

  it("fails closed for facility intake when authoritative config categories are unavailable", async () => {
    const { result, driver } = await execute("מזגן לא עובד", {
      module: "facility",
      config: { categories: [], zones: ["קבלה"] }
    });

    expect(result.executionStatus).toBe("blocked");
    expect(result.unknowns).toContain("category_config_unavailable");
    expect(result.blockingQuestion).toBe("לא ניתן כרגע לאמת את קטגוריית הקריאה. נסו שוב בעוד זמן קצר.");
    expect(JSON.stringify(result)).not.toContain("stack");
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("fails closed for facility intake when authoritative zones are unavailable or empty", async () => {
    for (const config of [
      { categories: defaultConfig.categories, zones: [] },
      { categories: defaultConfig.categories }
    ]) {
      const { result, driver } = await execute("מזגן לא עובד בחדר מפעיל מערכת. באזור קבלה", {
        module: "facility",
        config
      });

      expect(result.executionStatus).toBe("blocked");
      expect(result.unknowns).toContain("location_config_unavailable");
      expect(result.blockingQuestion).toBe("לא ניתן כרגע לאמת את האזור. נסו שוב בעוד זמן קצר.");
      expect(result.answer || result.blockingQuestion).not.toContain("zone");
      expect(driver.create).not.toHaveBeenCalled();
    }
  });

  it("does not use a hardcoded category fallback when the category is absent from config", async () => {
    const { result, driver } = await execute("מזגן לא עובד בחדר מפעיל מערכת. באזור קבלה", {
      module: "facility",
      config: { categories: [{ id: "other", label: "אחר" }], zones: ["קבלה"] }
    });

    expect(result.executionStatus).toBe("blocked");
    expect(result.unknowns).toContain("category");
    expect(result.blockingQuestion).toBe("לאיזו קטגוריית אחזקה זה שייך?");
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("keeps transport asset resolution independent from facility config authority", async () => {
    const { result, driver } = await execute("במלגזה 210 הגלגלים שבורים", {
      context: { fleet: [{ id: "forklift-210", code: "210", department: "Ops" }], tickets: [] },
      config: {}
    });

    expect(result.executionStatus).toBe("created");
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({
      track: "transport",
      forkliftId: "forklift-210",
      asset: "210"
    }), expect.any(Object));
  });

  it("treats controlled smoke test wording as a rollout label, not a smoke hazard", async () => {
    const { result, driver } = await execute("Создай тестовую транспортную заявку для 226: Controlled autonomous AI smoke test.");

    expect(result.executionStatus).toBe("created");
    expect(result.actionResult).toMatchObject({ ticketId: "ticket-226", ticketNumber: "T-1842" });
    expect(driver.create).toHaveBeenCalledTimes(1);
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

  it("blocks a permitted manager from creating for assets outside the filtered fleet", async () => {
    const scopedUser = { id: "user-a", role: "user", name: "User A", department: "Ops", departments: ["Ops"], permissions: autonomyPermission };
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
    const admin = { id: "admin-1", role: "admin", name: "Admin", permissions: autonomyPermission };
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

  it("lets an executive with explicit autonomy permission create a transport ticket", async () => {
    const executive = { id: "exec-1", role: "executive", name: "Executive", permissions: autonomyPermission };
    const { result, driver } = await execute("Не работает вентилятор на машине 226", {
      user: executive
    });

    expect(result.executionStatus).toBe("created");
    expect(driver.create).toHaveBeenCalledWith(expect.objectContaining({
      createdBy: expect.objectContaining({ id: "exec-1", role: "executive" }),
      forkliftId: "forklift-226"
    }), expect.objectContaining({ actorId: "exec-1" }));
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
    expect(ticket.ai).toMatchObject({ source: "inline_ai_ticket_intake", autonomous: true, capability: "create_ticket" });
    expect(options).toMatchObject({ actorId: "u1" });
  });

  it.each([
    ["admin without explicit autonomy permission", { id: "admin-no-perm", role: "admin", name: "Admin" }, "autonomy_permission"],
    ["manager without explicit autonomy permission", { id: "manager-no-perm", role: "user", name: "Manager" }, "autonomy_permission"],
    ["worker without autonomy permission", { id: "worker-1", role: "worker", name: "Worker" }, "autonomy_permission"],
    ["tech without autonomy permission", { id: "tech-1", role: "tech", name: "Tech" }, "autonomy_permission"],
    ["worker with accidental autonomy permission", { id: "worker-2", role: "worker", name: "Worker", permissions: autonomyPermission }, "autonomy_permission"],
    ["tech with accidental autonomy permission", { id: "tech-2", role: "tech", name: "Tech", permissions: autonomyPermission }, "autonomy_permission"],
    ["inactive manager with autonomy permission", { id: "inactive-1", role: "user", name: "Inactive", active: false, permissions: autonomyPermission }, "autonomy_permission"]
  ])("denies %s before persistence", async (_label, scopedUser, unknown) => {
    const { result, driver } = await execute("Не работает вентилятор на машине 226", { user: scopedUser });

    expect(result.executionStatus).toBe("permission_denied");
    expect(result.unknowns).toContain(unknown);
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("replays the same idempotency result without creating a second semantic response", async () => {
    const { result } = await execute("Не работает вентилятор на машине 226", { replayed: true });

    expect(result.executionStatus).toBe("replayed");
    expect(result.answer).toContain("T-1842");
  });

  it("returns conflict for idempotency conflicts and failed for persistence errors", async () => {
    const conflict = { create: vi.fn().mockRejectedValue(new Error("idempotency_conflict")) };
    expect((await execute("Не работает вентилятор на машине 226", { driver: conflict })).result).toMatchObject({
      executionStatus: "conflict",
      unknowns: ["idempotency_conflict"]
    });

    const failure = { create: vi.fn().mockRejectedValue(new Error("boom")) };
    expect((await execute("Не работает вентилятор на машине 226", { driver: failure })).result).toMatchObject({
      executionStatus: "failed",
      unknowns: ["create_failed"]
    });
  });
});
