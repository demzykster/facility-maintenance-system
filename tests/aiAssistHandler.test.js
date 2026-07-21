import { describe, expect, it, vi } from "vitest";
import { createAiAssistHandler } from "../server/ai/assistHandler.js";
import { signCmmsSessionToken } from "../server/session/cmmsSessionToken.js";

const autonomyPermission = { aiAutonomousTicketCreate: "request" };

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

function sessionClient(profile = {}) {
  return {
    getAuthUser: vi.fn().mockResolvedValue({ id: "auth-1", email: "vadim@example.com" }),
    getAppUserProfile: vi.fn().mockResolvedValue({
      id: "u1",
      auth_user_id: "auth-1",
      active: true,
      role: "admin",
      name: "Vadim",
      department: "הפצה",
      departments: ["הפצה"],
      ...profile
    })
  };
}

async function call(handler, req = {}) {
  const res = createRes();
  await handler({
    method: "POST",
    headers: { authorization: "Bearer token" },
    body: { text: "מלגזה תקועה באזור טעינה" },
    ...req
  }, res);
  return res;
}

function inlineTicketBody(body = {}) {
  const context = body.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context : {};
  return {
    ...body,
    workflow: "ticket_intake",
    context: {
      ...context,
      uiSurface: "inline_ticket_create",
      taskSession: { type: "ticket_intake", transient: true, ...(context.taskSession || {}) }
    }
  };
}

describe("AI assist handler", () => {
  it("requires POST and an authenticated user session", async () => {
    const handler = createAiAssistHandler({ rateBuckets: new Map() });

    const getRes = await call(handler, { method: "GET" });
    expect(getRes.statusCode).toBe(405);
    expect(getRes.headers.allow).toBe("POST");

    const unauthRes = await call(handler, { headers: {} });
    expect(unauthRes.statusCode).toBe(401);
    expect(unauthRes.json()).toEqual({ error: "access_token_required" });
  });

  it("returns the deterministic draft but stays closed when server AI is disabled", async () => {
    const providerCall = vi.fn();
    const handler = createAiAssistHandler({
      sessionClient: sessionClient(),
      providerCall,
      now: () => 100,
      rateBuckets: new Map()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      error: "ai_server_disabled",
      draft: {
        createdAt: 100,
        module: "transport",
        allowedToWrite: false,
        writePolicy: "human_confirmation_required"
      }
    });
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("executes the allowlisted ticket.create capability when autonomous create is enabled", async () => {
    const providerCall = vi.fn();
    const ticketsDriver = {
      create: vi.fn().mockResolvedValue({
        ticketId: "ticket-226",
        num: 1842,
        ticketNo: "T-1842",
        status: "new",
        idempotencyStatus: "created"
      })
    };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      providerCall,
      now: () => 1000,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: inlineTicketBody({
        text: "Не работает вентилятор на машине 226, приоритет средний",
        idempotencyKey: "idem-226",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      })
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      assistant: {
        provider: "cmms-capability",
        model: "ticket.create",
        text: expect.stringContaining("נפתחה קריאה T-1842")
      },
      capabilityResponse: {
        executionStatus: "created",
        actionResult: { type: "ticket.create", ticketId: "ticket-226", num: 1842, ticketNumber: "T-1842", ticketNo: "T-1842" }
      }
    });
    expect(ticketsDriver.create).toHaveBeenCalledWith(expect.objectContaining({ downtimeType: "needs_triage" }), expect.objectContaining({
      idempotencyKey: "idem-226"
    }));
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("resolves inline ticket intake assets from server-visible fleet beyond compact client context", async () => {
    const providerCall = vi.fn();
    const ticketsDriver = {
      create: vi.fn().mockResolvedValue({
        ticketId: "ticket-210",
        num: 2101,
        ticketNo: "T-2101",
        status: "new",
        idempotencyStatus: "created"
      })
    };
    const fleetDriver = {
      list: vi.fn().mockResolvedValue([
        ...Array.from({ length: 18 }, (_, index) => ({
          id: `fleet-${100 + index}`,
          code: String(100 + index),
          department: "נפחי"
        })),
        { id: "fleet-210-archived", code: "210", type: "מלקטת", department: "נפחי", status: "archived" },
        { id: "fleet-210", code: "210", type: "מלקטת", department: "נפחי" }
      ])
    };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "נפחי", departments: ["נפחי"], permissions: autonomyPermission }),
      ticketsDriver,
      fleetDriver,
      providerCall,
      now: () => 1001,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "במלגזה 210 הגלגלים שבורים, עדיפות בינונית",
        idempotencyKey: "idem-inline-210",
        workflow: "ticket_intake",
        context: {
          uiSurface: "inline_ticket_create",
          taskSession: { type: "ticket_intake", transient: true },
          fleet: [{ id: "fleet-100", code: "100", department: "נפחי" }],
          tickets: []
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().capabilityResponse).toMatchObject({
      executionStatus: "created",
      actionResult: { ticketId: "ticket-210", ticketNumber: "T-2101" }
    });
    expect(ticketsDriver.create).toHaveBeenCalledWith(expect.objectContaining({
      forkliftId: "fleet-210",
      asset: "210"
    }), expect.any(Object));
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("creates facility tickets through the same inline capability after resolving server config location", async () => {
    const providerCall = vi.fn();
    const ticketsDriver = {
      create: vi.fn().mockResolvedValue({
        ticketId: "ticket-facility",
        num: 3001,
        ticketNo: "F-3001",
        status: "new",
        idempotencyStatus: "created"
      })
    };
    const appConfigDriver = {
      get: vi.fn().mockResolvedValue({
        config: {
          categories: [{ id: "hvac", label: "מיזוג אוויר" }, { id: "other", label: "אחר" }],
          zones: ["משרדי הפצה", "מחסן ראשי"]
        }
      })
    };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      appConfigDriver,
      providerCall,
      now: () => 1002,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: inlineTicketBody({
        text: "מזגן לא עובד בחדר מפעיל מערכת. באזור משרדי הפצה. עדיפות בינונית",
        idempotencyKey: "idem-facility",
        module: "facility",
        context: { fleet: [], tickets: [] }
      })
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      assistant: {
        provider: "cmms-capability",
        model: "ticket.create",
        text: expect.stringContaining("נפתחה קריאה F-3001")
      },
      capabilityResponse: {
        executionStatus: "created",
        actionResult: {
          ticketId: "ticket-facility",
          track: "facility",
          zone: "משרדי הפצה",
          category: "hvac",
          categoryLabel: "מיזוג אוויר"
        }
      }
    });
    expect(ticketsDriver.create).toHaveBeenCalledWith(expect.objectContaining({
      track: "facility",
      zone: "משרדי הפצה",
      priority: "medium"
    }), expect.objectContaining({ idempotencyKey: "idem-facility" }));
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("does not create facility tickets when server app config cannot validate category or zone", async () => {
    const providerCall = vi.fn();
    const ticketsDriver = { create: vi.fn() };
    const appConfigDriver = { get: vi.fn().mockRejectedValue(new Error("app_config_down")) };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      appConfigDriver,
      providerCall,
      now: () => 1003,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: inlineTicketBody({
        text: "מזגן לא עובד בחדר מפעיל מערכת. באזור קבלה",
        idempotencyKey: "idem-facility-config-down",
        module: "facility",
        context: { fleet: [], tickets: [] }
      })
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().capabilityResponse).toMatchObject({
      executionStatus: "blocked",
      unknowns: ["category_config_unavailable"]
    });
    expect(res.json().assistant.text).toBe("לא ניתן כרגע לאמת את קטגוריית הקריאה. נסו שוב בעוד זמן קצר.");
    expect(res.json().assistant.text).not.toContain("zone");
    expect(res.json().assistant.text).not.toContain("app_config");
    expect(ticketsDriver.create).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("blocks autonomous create when global flag is on but the server-side user lacks explicit autonomy permission", async () => {
    const providerCall = vi.fn();
    const ticketsDriver = { create: vi.fn() };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: {} }),
      ticketsDriver,
      auditDriver,
      providerCall,
      now: () => 1001,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: inlineTicketBody({
        text: "Не работает вентилятор на машине 226",
        idempotencyKey: "idem-no-perm",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      })
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().capabilityResponse).toMatchObject({
      executionStatus: "permission_denied",
      unknowns: ["autonomy_permission"]
    });
    expect(ticketsDriver.create).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
    expect(auditDriver.write.mock.calls[0][0].metadata).toMatchObject({
      outcome: "blocked",
      reason: "permission_denied",
      autonomyPermissionKey: "aiAutonomousTicketCreate",
      autonomyPermissionLevel: "none",
      autonomyPermissionRequired: "request",
      autonomyPermitted: false,
      autonomyEffectiveAccess: false
    });
  });

  it("does not trust role or permission values supplied in the AI request body", async () => {
    const providerCall = vi.fn();
    const ticketsDriver = { create: vi.fn() };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: {} }),
      ticketsDriver,
      providerCall,
      now: () => 1002,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: inlineTicketBody({
        text: "Не работает вентилятор на машине 226",
        idempotencyKey: "idem-spoof",
        role: "admin",
        permissions: { aiAutonomousTicketCreate: "request" },
        context: {
          profile: { role: "admin", permissions: { aiAutonomousTicketCreate: "request" } },
          fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }],
          tickets: []
        }
      })
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().capabilityResponse).toMatchObject({
      executionStatus: "permission_denied",
      unknowns: ["autonomy_permission"]
    });
    expect(ticketsDriver.create).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("keeps autonomous create blocked when the global flag is off even if the user has permission", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-test",
      text: "הכנתי כרטיס לאישור."
    });
    const ticketsDriver = { create: vi.fn() };
    const handler = createAiAssistHandler({
      env: {
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      providerCall,
      now: () => 1003,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: inlineTicketBody({
        text: "Не работает вентилятор на машине 226",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      })
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.provider).toBe("openai");
    expect(ticketsDriver.create).not.toHaveBeenCalled();
  });

  it("completes deterministic inline facility intake without calling the provider when config is authoritative", async () => {
    const providerCall = vi.fn();
    const ticketsDriver = {
      create: vi.fn().mockResolvedValue({
        ticketId: "ticket-facility-qa",
        num: 42,
        ticketNo: "F-042",
        status: "new",
        idempotencyStatus: "created"
      })
    };
    const appConfigDriver = {
      get: vi.fn().mockResolvedValue({
        config: {
          categories: [{ id: "hvac", label: "מיזוג אוויר" }],
          zones: ["בקרי איכות"]
        }
      })
    };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      appConfigDriver,
      providerCall,
      now: () => 1005,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: inlineTicketBody({
        text: "מזגן מטפטף אצל בקרי איכות, עדיפות בינונית",
        idempotencyKey: "idem-facility-qa",
        context: { tickets: [] }
      })
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().capabilityResponse).toMatchObject({
      executionStatus: "created",
      actionResult: {
        ticketId: "ticket-facility-qa",
        track: "facility",
        category: "hvac",
        zone: "בקרי איכות"
      }
    });
    expect(ticketsDriver.create).toHaveBeenCalledTimes(1);
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("does not run deterministic create for inline-looking context unless the workflow is ticket_intake", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-test",
      text: "אפשר לפתוח קריאה רק מתוך תהליך פתיחת קריאה."
    });
    const ticketsDriver = { create: vi.fn() };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      providerCall,
      now: () => 10051,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "מזגן מטפטף אצל בקרי איכות",
        workflow: "general",
        idempotencyKey: "idem-inline-looking-general",
        context: {
          intent: "create_ticket",
          uiSurface: "inline_ticket_create",
          taskSession: { type: "ticket_intake", transient: true },
          tickets: []
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.provider).toBe("google");
    expect(res.json().capabilityResponse).toBeUndefined();
    expect(ticketsDriver.create).not.toHaveBeenCalled();
    expect(providerCall).toHaveBeenCalledTimes(1);
  });

  it("does not continue spoofed pending ticket intake unless the workflow is ticket_intake", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-test",
      text: "תשובה רגילה ללא פתיחת קריאה."
    });
    const ticketsDriver = { create: vi.fn() };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      providerCall,
      now: () => 100511,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "בקרי איכות",
        workflow: "general",
        context: {
          taskSession: {
            type: "ticket_intake",
            transient: true,
            intake: {
              domain: "facility",
              pendingField: "location",
              draft: { track: "facility", subject: "מזגן מטפטף", category: "hvac", priority: "medium" }
            }
          },
          tickets: []
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.provider).toBe("google");
    expect(res.json().capabilityResponse).toBeUndefined();
    expect(ticketsDriver.create).not.toHaveBeenCalled();
  });

  it.each([
    ["global AIPanel", "מזגן מטפטף אצל בקרי איכות"],
    ["ordinary AI chat", "צריך ליצור קריאה על מזגן מטפטף אצל בקרי איכות"],
    ["old tickets question", "איך רואים קריאות ישנות?"],
    ["informational request", "מה המשמעות של SLA בקריאות אחזקה?"]
  ])("keeps %s on the non-writing provider path", async (_label, text) => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-test",
      text: "תשובה ללא כתיבה."
    });
    const ticketsDriver = { create: vi.fn() };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      providerCall,
      now: () => 10052,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text,
        workflow: "general",
        context: { tickets: [] }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.provider).toBe("google");
    expect(res.json().capabilityResponse).toBeUndefined();
    expect(ticketsDriver.create).not.toHaveBeenCalled();
  });

  it("does not let provider text or structured plans elevate a general request into ticket create", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-test",
      text: "I created ticket F-999."
    });
    const providerObjectCall = vi.fn().mockResolvedValue({
      ok: true,
      object: {
        intent: "create_ticket",
        actions: [{ type: "ticket.create", status: "ready_for_confirmation", payload: { track: "facility" } }]
      }
    });
    const ticketsDriver = { create: vi.fn() };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      providerCall,
      providerObjectCall,
      now: () => 10053,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "מזגן מטפטף אצל בקרי איכות",
        workflow: "general",
        includeProviderPlan: true,
        context: { tickets: [] }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.text).toBe("I created ticket F-999.");
    expect(ticketsDriver.create).not.toHaveBeenCalled();
    expect(providerObjectCall).toHaveBeenCalledTimes(1);
  });

  it("fails closed without ticket create when facility config lookup times out before planning", async () => {
    const providerCall = vi.fn();
    const ticketsDriver = { create: vi.fn() };
    const appConfigDriver = {
      get: vi.fn(() => new Promise(() => {}))
    };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_INLINE_TICKET_BOUNDARY_TIMEOUT_MS: "5",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      appConfigDriver,
      providerCall,
      now: () => 1006,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: inlineTicketBody({
        text: "מזגן מטפטף אצל בקרי איכות",
        idempotencyKey: "idem-facility-timeout",
        context: { tickets: [] }
      })
    });

    expect(res.statusCode).toBe(504);
    expect(res.json()).toMatchObject({
      error: "inline_ticket_intake_timeout",
      stage: "config"
    });
    expect(ticketsDriver.create).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("fails closed without ticket create when fleet lookup times out before transport planning", async () => {
    const providerCall = vi.fn();
    const ticketsDriver = { create: vi.fn() };
    const fleetDriver = {
      list: vi.fn(() => new Promise(() => {}))
    };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_INLINE_TICKET_BOUNDARY_TIMEOUT_MS: "5",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      fleetDriver,
      providerCall,
      now: () => 10061,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: inlineTicketBody({
        text: "במלגזה 210 ראש קילש לא עובד",
        idempotencyKey: "idem-fleet-timeout",
        context: { tickets: [] }
      })
    });

    expect(res.statusCode).toBe(504);
    expect(res.json()).toMatchObject({
      error: "inline_ticket_intake_timeout",
      stage: "fleet"
    });
    expect(ticketsDriver.create).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("returns a controlled provider timeout instead of hanging a general assist request", async () => {
    const providerCall = vi.fn(() => new Promise(() => {}));
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_PROVIDER_TIMEOUT_MS: "5",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user" }),
      providerCall,
      now: () => 1007,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "מה מצב התחזוקה?",
        language: "he",
        workflow: "general",
        context: { tickets: [] }
      }
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({
      error: "ai_provider_failed",
      providerErrorCode: "ai_provider_timeout"
    });
  });

  it("blocks inactive authenticated users before autonomous permission can be used", async () => {
    const handler = createAiAssistHandler({
      sessionClient: sessionClient({ active: false, role: "user", permissions: autonomyPermission }),
      now: () => 1004,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: inlineTicketBody({
        text: "Не работает вентилятор на машине 226",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      })
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "app_user_disabled" });
  });

  it.each([
    ["worker", { id: "worker-a", role: "worker", permissions: {} }],
    ["tech", { id: "tech-a", role: "tech", permissions: {} }],
    ["manager", { id: "manager-no-perm", role: "user", permissions: {} }]
  ])("blocks %s autonomous create without explicit management permission", async (_label, profile) => {
    const ticketsDriver = { create: vi.fn() };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(profile),
      ticketsDriver,
      now: () => 1005,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: inlineTicketBody({
        text: "Не работает вентилятор на машине 226",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      })
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().capabilityResponse).toMatchObject({
      executionStatus: "permission_denied",
      unknowns: ["autonomy_permission"]
    });
    expect(ticketsDriver.create).not.toHaveBeenCalled();
  });

  it("keeps facility autonomous requests on the normal no-write provider path", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-test",
      text: "אפשר להכין קריאת אחזקה לאישור ידני."
    });
    const ticketsDriver = { create: vi.fn() };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      providerCall,
      now: () => 1006,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "Создай facility заявку по кондиционеру в офисе",
        module: "facility",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.provider).toBe("openai");
    expect(ticketsDriver.create).not.toHaveBeenCalled();
  });

  it("keeps general transport create wording on the no-write provider path without dedicated ticket intake", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-test",
      text: "אפשר להכין טיוטת קריאה לאישור."
    });
    const ticketsDriver = { create: vi.fn() };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      providerCall,
      now: () => 1007,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "פתח קריאה במלגזה 226",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.provider).toBe("openai");
    expect(ticketsDriver.create).not.toHaveBeenCalled();
  });

  it("writes an autonomous ticket create audit event for created results without raw request data", async () => {
    const providerCall = vi.fn();
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const ticketsDriver = {
      create: vi.fn().mockResolvedValue({
        ticketId: "ticket-226",
        num: 1842,
        ticketNo: "T-1842",
        status: "new",
        idempotencyStatus: "created"
      })
    };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      providerCall,
      auditDriver,
      now: () => 1000,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer token", "x-request-id": "req-226" },
      body: inlineTicketBody({
        text: "Не работает вентилятор на машине 226, приоритет средний, secret-prompt-fragment",
        idempotencyKey: "idem-226",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] },
        ticket: {
          id: "client-id",
          ticketNo: "F-999",
          status: "done",
          actor_id: "attacker",
          createdBy: { id: "attacker" }
        }
      })
    });

    expect(res.statusCode).toBe(200);
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      at: 1000,
      actorId: "u1",
      actorRole: "user",
      entityType: "system",
      action: "ai_assist",
      metadata: expect.objectContaining({
        provider: "not_used",
        model: "not_used",
        providerStatus: "ok",
        capability: "create_ticket",
        autonomous: true,
        outcome: "created",
        requestId: "req-226",
        ticketId: "ticket-226",
        ticketNumber: "T-1842",
        resolvedAssetId: "forklift-226",
        domain: "transport",
        autonomyConfigured: true,
        serverCreateReady: true,
        serverCreateConfigured: true
      })
    }));
    const [ticket, createOptions] = ticketsDriver.create.mock.calls[0];
    expect(ticket.id).toMatch(/^ticket-/);
    expect(ticket.id).not.toBe("client-id");
    expect(ticket.ticketNo).toBeUndefined();
    expect(ticket.status).toBe("new");
    expect(ticket.createdBy).toMatchObject({ id: "u1", role: "user" });
    expect(ticket.reportedBy).toMatchObject({ id: "u1", role: "user" });
    expect(createOptions).toMatchObject({ actorId: "u1", idempotencyKey: "idem-226" });
    const auditPayload = JSON.stringify(auditDriver.write.mock.calls[0][0]);
    expect(auditPayload).not.toContain("secret-prompt-fragment");
    expect(auditPayload).not.toContain("attacker");
  });

  it("audits replayed, conflict, blocked, and failed autonomous ticket outcomes", async () => {
    async function runWithDriver({ driver, body = {}, now = 1100 }) {
      const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
      const handler = createAiAssistHandler({
        env: {
          CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
          CMMS_TICKET_SERVER_CREATE_V2: "local",
          CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
          CMMS_APP_MODE: "local",
          CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
        },
        sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
        ticketsDriver: driver,
        auditDriver,
        now: () => now,
        rateBuckets: new Map()
      });
      const res = await call(handler, {
        body: inlineTicketBody({
          text: "Не работает вентилятор на машине 226, приоритет средний",
          idempotencyKey: `idem-${now}`,
          context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] },
          ...body
        })
      });
      return { res, auditDriver };
    }

    const replayed = await runWithDriver({
      now: 1101,
      driver: {
        create: vi.fn().mockResolvedValue({
          ticketId: "ticket-226",
          num: 1842,
          ticketNo: "T-1842",
          status: "new",
          idempotencyStatus: "replayed"
        })
      }
    });
    expect(replayed.res.statusCode).toBe(200);
    expect(replayed.auditDriver.write.mock.calls[0][0].metadata).toMatchObject({ outcome: "replayed", ticketId: "ticket-226" });

    const conflictDriver = { create: vi.fn().mockRejectedValue(new Error("idempotency_conflict")) };
    const conflict = await runWithDriver({ now: 1102, driver: conflictDriver });
    expect(conflict.res.statusCode).toBe(200);
    expect(conflict.auditDriver.write.mock.calls[0][0].metadata).toMatchObject({ outcome: "conflict", reason: "idempotency_conflict" });

    const blockedDriver = { create: vi.fn() };
    const blocked = await runWithDriver({
      now: 1103,
      driver: blockedDriver,
      body: {
        text: "Не работает вентилятор",
        context: { fleet: [], tickets: [], currentEntity: { id: "forklift-226", code: "226", department: "הפצה" } }
      }
    });
    expect(blocked.res.statusCode).toBe(200);
    expect(blockedDriver.create).not.toHaveBeenCalled();
    expect(blocked.auditDriver.write.mock.calls[0][0].metadata).toMatchObject({ outcome: "blocked", reason: "asset" });

    const failed = await runWithDriver({
      now: 1104,
      driver: { create: vi.fn().mockRejectedValue(new Error("rpc_down")) }
    });
    expect(failed.res.statusCode).toBe(200);
    expect(failed.auditDriver.write.mock.calls[0][0].metadata).toMatchObject({ outcome: "failed", reason: "create_failed" });
  });

  it("blocks autonomous create for spoofed currentEntity outside the filtered context before persistence", async () => {
    const providerCall = vi.fn();
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const ticketsDriver = { create: vi.fn() };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", id: "manager-a", department: "הפצה", departments: ["הפצה"], permissions: autonomyPermission }),
      ticketsDriver,
      providerCall,
      auditDriver,
      now: () => 1200,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: inlineTicketBody({
        text: "Не работает вентилятор",
        context: {
          currentEntity: { id: "forklift-other", code: "226", name: "226", department: "מחסן" },
          fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }],
          tickets: []
        }
      })
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().capabilityResponse).toMatchObject({
      executionStatus: "blocked",
      unknowns: ["asset"]
    });
    expect(ticketsDriver.create).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
    expect(auditDriver.write.mock.calls[0][0].metadata).toMatchObject({
      outcome: "blocked",
      reason: "asset"
    });
  });

  it("does not execute autonomous ticket.create when the server-create cutover is disabled", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-test",
      text: "הכנתי כרטיס לאישור."
    });
    const ticketsDriver = {
      create: vi.fn()
    };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user" }),
      ticketsDriver,
      providerCall,
      now: () => 1000,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "Не работает вентилятор на машине 226",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.provider).toBe("openai");
    expect(ticketsDriver.create).not.toHaveBeenCalled();
  });

  it("does not execute autonomous ticket.create when the server-create dependency is unavailable", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-test",
      text: "הבקשה תישאר לאישור ידני."
    });
    const ticketsDriver = {};
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user" }),
      ticketsDriver,
      providerCall,
      now: () => 1000,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "Не работает вентилятор на машине 226",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.provider).toBe("openai");
    expect(providerCall).toHaveBeenCalled();
  });

  it("falls back to the provider path when the autonomous flag is enabled but intent is not ticket create", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-test",
      text: "אין חריגות פתוחות."
    });
    const ticketsDriver = { create: vi.fn() };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user" }),
      ticketsDriver,
      providerCall,
      now: () => 1000,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "Что сегодня важно?",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.provider).toBe("openai");
    expect(providerCall).toHaveBeenCalled();
    expect(ticketsDriver.create).not.toHaveBeenCalled();
  });

  it("returns a precise setup error when server AI has no provider key", async () => {
    const providerCall = vi.fn();
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 120,
      rateBuckets: new Map()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      error: "ai_provider_key_required",
      draft: {
        createdAt: 120,
        allowedToWrite: false
      }
    });
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("accepts a valid CMMS PIN session before using the server provider", async () => {
    const secret = "cmms-secret";
    const signed = signCmmsSessionToken("worker-7", "worker", "11032", secret, Date.now(), 60_000);
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "anthropic",
      model: "claude-test",
      text: "צריך לוודא מספר כלי."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_SESSION_SECRET: secret,
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "10000"
      },
      pinSessionClient: {
        findPinSessionUser: vi.fn().mockResolvedValue({
          id: "worker-7",
          workerNo: "11032",
          role: "worker",
          name: "Worker",
          active: true
        })
      },
      providerCall,
      now: () => 2000,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${signed.token}` }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      draft: {
        actor: {
          id: "worker-7",
          role: "worker"
        }
      },
      assistant: {
        provider: "anthropic",
        text: "צריך לוודא מספר כלי."
      }
    });
  });

  it("calls the configured server provider without returning provider secrets", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "צריך לציין מספר כלי ומיקום מדויק."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 123,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "באזור טעינה מלגזה תקועה ויש עשן",
        language: "he",
        source: "mobile"
      }
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload).toMatchObject({
      ok: true,
      draft: {
        source: "mobile",
        module: "transport",
        severity: "critical",
        allowedToWrite: false
      },
      actions: [
        expect.objectContaining({
          id: "create_ticket",
          type: "ticket.create",
          status: "needs_human_input",
          requiresConfirmation: true,
          writesData: false,
          writePolicy: "human_confirmation_required",
          missingFields: expect.arrayContaining(["forkliftId"]),
          execute: {
            method: "POST",
            path: "/api/tickets",
            bodyField: "ticket"
          }
        })
      ],
      assistant: {
        provider: "openai",
        model: "gpt-5.2",
        text: "צריך לציין מספר כלי ומיקום מדויק."
      }
    });
    expect(JSON.stringify(payload)).not.toContain("server-secret");
    expect(providerCall).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        provider: "openai",
        openaiApiKey: "server-secret"
      }),
      system: expect.stringContaining("read-only"),
      maxTokens: 700
    }));
  });

  it("tells the provider when a deterministic action is ready so it does not ask stale questions", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "הכנתי דיווח ניקיון לאישור."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 123,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "הרצפה מלוכלכת במטבחון קומה 2",
        language: "he",
        context: {
          cleaning: {
            zones: [
              { id: "zone-kitchen-2", name: "מטבחון קומה 2", location: "בניין A", active: true }
            ]
          }
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().actions[0]).toMatchObject({
      type: "cleaning.complaint.create",
      status: "ready_for_confirmation",
      payload: {
        zoneId: "zone-kitchen-2",
        zoneName: "מטבחון קומה 2"
      }
    });
    const prompt = JSON.parse(providerCall.mock.calls[0][0].prompt);
    expect(prompt.actionGuidance).toMatchObject({
      hasActionProposal: true,
      readyActionCount: 1,
      actionTypes: ["cleaning.complaint.create"],
      missingFields: []
    });
    expect(prompt.actionGuidance.instruction).toContain("Do not ask for fields that are already resolved");
  });

  it("keeps Russian explanation questions read-only and focused on the latest request", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.1-flash-lite",
      text: "Вы видите эти уведомления, потому что есть документы техники с истёкшим или близким сроком."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "gemini",
        GOOGLE_GENERATIVE_AI_API_KEY: "google-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 127,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "почему я вижу много уведомлений по документам техники?",
        messages: [{ role: "user", content: "почему я вижу много уведомлений по документам техники?" }],
        context: {
          fleet: {
            docs: [
              { id: "doc-1", unitCode: "178040", title: "ביטוח", status: "expired", daysLeft: -1, department: "הפצה" },
              { id: "doc-2", unitCode: "120823", title: "רישיון", status: "soon", daysLeft: 8, department: "הפצה" }
            ]
          }
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload).toMatchObject({
      ok: true,
      draft: {
        module: "transport",
        action: "no_action",
        missingInfo: []
      },
      actions: [],
      assistant: {
        provider: "google",
        model: "gemini-3.1-flash-lite"
      }
    });
    const prompt = JSON.parse(providerCall.mock.calls[0][0].prompt);
    expect(prompt.responseLanguage).toMatchObject({ code: "ru", source: "latest_user_message" });
    expect(prompt.userRequest).toBe("почему я вижу много уведомлений по документам техники?");
    expect(prompt.contract.expectedOutput).toContain("Answer in Russian");
    expect(prompt.context.fleet).toEqual([
      { id: "doc-1", code: "178040", type: "ביטוח", department: "הפצה", status: "expired", docsDueDays: -1 },
      { id: "doc-2", code: "120823", type: "רישיון", department: "הפצה", status: "soon", docsDueDays: 8 }
    ]);
    expect(prompt.contextGuidance[0]).toMatchObject({
      topic: "fleet_document_notifications",
      visibleDocCount: 2,
      expiredCount: 1,
      upcomingCount: 1,
      examples: [
        { code: "178040", type: "ביטוח", daysLeft: -1 },
        { code: "120823", type: "רישיון", daysLeft: 8 }
      ]
    });
    expect(prompt.contextGuidance[0].instruction).toContain("Do not give generic settings advice");
    expect(JSON.stringify(payload)).not.toContain("google-secret");
  });

  it("can request a provider structured plan but only returns sanitized non-writing suggestions", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר להכין תוכנית פעולה."
    });
    const providerObjectCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      object: {
        summary: "תוכנית מוצעת",
        items: [
          {
            type: "ticket.update",
            title: "עדכן עדיפות",
            reason: "יש קריאה יחידה בהקשר",
            confidence: 0.8,
            execute: { method: "POST", path: "/api/tickets" },
            writesData: true
          },
          { type: "sql.delete", title: "מחיקה אסורה" }
        ]
      }
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      providerObjectCall,
      now: () => 125,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "תכין תוכנית טיפול",
        includeProviderPlan: true,
        context: {
          tickets: [
            { id: "T-1", subject: "דליפת מים", priority: "medium", status: "new", department: "הפצה" }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload).toMatchObject({
      ok: true,
      providerPlan: {
        summary: "תוכנית מוצעת",
        writesData: false,
        writePolicy: "human_confirmation_required",
        providerTextTrusted: false,
        items: [
          expect.objectContaining({
            type: "ticket.update",
            title: "עדכן עדיפות",
            requiresConfirmation: true,
            writesData: false,
            writePolicy: "human_confirmation_required"
          })
        ]
      }
    });
    expect(payload.providerPlan.items).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain("/api/tickets");
    expect(JSON.stringify(payload)).not.toContain("sql.delete");
    expect(JSON.stringify(payload)).not.toContain("server-secret");
    expect(providerObjectCall).toHaveBeenCalledWith(expect.objectContaining({
      schemaName: "cmms_ai_non_writing_action_plan",
      prompt: expect.stringContaining("allowedToWrite")
    }));
  });

  it("does not fail the main assistant response when optional provider plan generation fails", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.1-flash-lite",
      text: "אפשר להמשיך."
    });
    const providerObjectCall = vi.fn().mockResolvedValue({
      ok: false,
      provider: "google",
      model: "gemini-3.1-flash-lite",
      error: "quota exceeded"
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "gemini",
        GOOGLE_GENERATIVE_AI_API_KEY: "google-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      providerCall,
      providerObjectCall,
      now: () => 126,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "בדוק מה לעשות",
        structuredPlan: true
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      assistant: { provider: "google", model: "gemini-3.1-flash-lite", text: "אפשר להמשיך." },
      providerPlanErrorCode: "ai_provider_quota_exceeded"
    });
  });

  it("can call the Gemini server provider without returning provider secrets", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.1-flash-lite",
      text: "צריך לציין מספר כלי ומצב כלי."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "gemini",
        GOOGLE_GENERATIVE_AI_API_KEY: "google-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 124,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "באזור טעינה מלגזה תקועה",
        language: "he",
        source: "mobile"
      }
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload).toMatchObject({
      ok: true,
      assistant: {
        provider: "google",
        model: "gemini-3.1-flash-lite",
        text: "צריך לציין מספר כלי ומצב כלי."
      }
    });
    expect(JSON.stringify(payload)).not.toContain("google-secret");
    expect(providerCall).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        provider: "google",
        googleApiKey: "google-secret"
      }),
      system: expect.stringContaining("read-only"),
      maxTokens: 700
    }));
  });

  it("returns a safe provider error code when the OpenAI account has no quota", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: false,
      provider: "openai",
      model: "gpt-5.2",
      error: "You exceeded your current quota, please check your plan and billing details."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 130,
      rateBuckets: new Map()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({
      error: "ai_provider_failed",
      provider: "openai",
      providerErrorCode: "ai_provider_quota_exceeded",
      draft: {
        createdAt: 130,
        allowedToWrite: false
      }
    });
    expect(JSON.stringify(res.json())).not.toContain("server-secret");
  });

  it("returns deterministic ticket.update proposals from role-filtered single-ticket context", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר לעדכן לאחר אישור."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => 444,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "תעדכן את הקריאה לעדיפות גבוהה",
        context: {
          tickets: [
            { id: "T-1", subject: "דליפת מים", priority: "medium", status: "new", department: "הפצה" },
            { id: "T-2", subject: "נסתר", priority: "medium", status: "new", department: "קבלה" }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().actions).toEqual([
      expect.objectContaining({
        id: "update_ticket_T-1",
        type: "ticket.update",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          ticketId: "T-1",
          ticketTitle: "דליפת מים",
          current: { priority: "medium" },
          patch: { priority: "high" }
        }
      })
    ]);
  });

  it("prefills transport ticket drafts from role-filtered fleet context", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר להכין טיוטת קריאה לכלי לאחר אישור."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => 445,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "מלגזה 120823 תקועה באזור טעינה",
        context: {
          fleet: [
            { id: "fleet-120823", code: "120823", type: "מלגזת היגש", department: "הפצה" },
            { id: "fleet-hidden", code: "120823", type: "מלגזת היגש", department: "קבלה" }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().actions).toEqual([
      expect.objectContaining({
        id: "create_ticket",
        type: "ticket.create",
        status: "needs_form_review",
        requiresConfirmation: true,
        writesData: false,
        missingFields: ["priority", "downtimeType"],
        reviewMode: "ticket_form",
        payload: expect.objectContaining({
          track: "transport",
          forkliftId: "fleet-120823",
          asset: "120823",
          zone: "טעינה"
        })
      })
    ]);
    const prompt = JSON.parse(providerCall.mock.calls[0][0].prompt);
    expect(prompt.actionGuidance).toMatchObject({
      hasActionProposal: true,
      readyActionCount: 0,
      reviewInFormCount: 1,
      actionTypes: ["ticket.create"],
      missingFields: ["priority", "downtimeType"]
    });
    expect(prompt.actionGuidance.instruction).toContain("should be completed in the normal CMMS form");
    expect(prompt.actionGuidance.instruction).toContain("Do not ask a chat follow-up");
  });

  it("prefills explicit downtime type after server role filtering", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר להכין קריאה קריטית לאחר אישור."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => 448,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "מלגזה 120823 מושבתת ואין תחליף באזור טעינה",
        context: {
          fleet: [
            { id: "fleet-120823", code: "120823", type: "מלגזת היגש", department: "הפצה" },
            { id: "fleet-hidden", code: "120823", type: "מלגזת היגש", department: "קבלה" }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().actions).toEqual([
      expect.objectContaining({
        id: "create_ticket",
        type: "ticket.create",
        status: "needs_form_review",
        requiresConfirmation: true,
        writesData: false,
        missingFields: ["priority"],
        payload: expect.objectContaining({
          track: "transport",
          forkliftId: "fleet-120823",
          asset: "120823",
          downtimeType: "critical",
          priority: ""
        })
      })
    ]);
  });

  it("returns deterministic ticket zone updates from role-filtered single-ticket context", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר לעדכן את האזור לאחר אישור."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => 446,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "תעדכן את הקריאה לאזור משרדים",
        context: {
          tickets: [
            { id: "T-1", subject: "דליפת מים", priority: "medium", status: "new", zone: "קבלה", department: "הפצה" },
            { id: "T-2", subject: "נסתר", priority: "medium", status: "new", zone: "מחסן", department: "קבלה" }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().actions).toEqual([
      expect.objectContaining({
        id: "update_ticket_T-1",
        type: "ticket.update",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          ticketId: "T-1",
          ticketTitle: "דליפת מים",
          current: { zone: "קבלה" },
          patch: { zone: "משרדים" }
        }
      })
    ]);
  });

  it("returns deterministic transport unit updates from role-filtered fleet context", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר לשייך את הקריאה לכלי לאחר אישור."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => 447,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "תעדכן את הקריאה לכלי 120823",
        context: {
          tickets: [
            { id: "T-1", subject: "תקלה במלגזה", track: "transport", forkliftId: "", asset: "", department: "הפצה" },
            { id: "T-2", subject: "נסתר", track: "transport", forkliftId: "", asset: "", department: "קבלה" }
          ],
          fleet: [
            { id: "fleet-120823", code: "120823", type: "מלגזת היגש", department: "הפצה" },
            { id: "fleet-hidden", code: "120823", type: "מלגזת היגש", department: "קבלה" }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().actions).toEqual([
      expect.objectContaining({
        id: "update_ticket_T-1",
        type: "ticket.update",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          ticketId: "T-1",
          ticketTitle: "תקלה במלגזה",
          current: { forkliftId: "", asset: "" },
          patch: { forkliftId: "fleet-120823", asset: "120823" }
        }
      })
    ]);
  });

  it("returns deterministic ticket.comment proposals from role-filtered single-ticket context", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר להוסיף את ההערה לאחר אישור."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => 445,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "הוסף הערה: דיברתי עם הספק וממתינים לתשובה",
        context: {
          tickets: [
            { id: "T-1", subject: "דליפת מים", priority: "medium", status: "new", department: "הפצה" },
            { id: "T-2", subject: "נסתר", priority: "medium", status: "new", department: "קבלה" }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().actions).toEqual([
      expect.objectContaining({
        id: "comment_ticket_T-1",
        type: "ticket.comment",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          ticketId: "T-1",
          ticketTitle: "דליפת מים",
          note: "דיברתי עם הספק וממתינים לתשובה"
        }
      })
    ]);
  });

  it("returns deterministic task.create proposals through the assist endpoint without writing", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר ליצור את המשימה לאחר אישור."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => 446,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "משימה לבדוק הצעת מחיר למלגזה"
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      draft: {
        module: "task",
        action: "draft_task",
        allowedToWrite: false,
        writePolicy: "human_confirmation_required"
      },
      actions: [
        expect.objectContaining({
          id: "create_task",
          type: "task.create",
          requiresConfirmation: true,
          writesData: false,
          execute: {
            method: "POST",
            path: "/api/work",
            resource: "tasks",
            bodyField: "task"
          },
          payload: expect.objectContaining({
            title: "משימה לבדוק הצעת מחיר למלגזה",
            status: "todo",
            ownerId: "u1",
            responsibleIds: ["u1"]
          })
        })
      ]
    });
  });

  it("returns deterministic meeting.create proposals through the assist endpoint without writing", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר ליצור את הפגישה לאחר אישור."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => 448,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "פגישה מחר לעבור על תקלות בטיחות"
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      draft: {
        module: "task",
        action: "draft_task",
        allowedToWrite: false,
        writePolicy: "human_confirmation_required"
      },
      actions: [
        expect.objectContaining({
          id: "create_meeting",
          type: "meeting.create",
          requiresConfirmation: true,
          writesData: false,
          execute: {
            method: "POST",
            path: "/api/work",
            resource: "meetings",
            bodyField: "meeting"
          },
          payload: expect.objectContaining({
            title: "פגישה מחר לעבור על תקלות בטיחות",
            type: "boss",
            status: "planned",
            ownerId: "u1",
            participantIds: ["u1"],
            at: 448 + 86400000
          })
        })
      ]
    });
  });

  it("returns deterministic task.update proposals from role-filtered single-task context", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר לעדכן את המשימה לאחר אישור."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => 447,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "תעדכן את המשימה לעדיפות גבוהה",
        context: {
          tasks: [
            { id: "task-visible", title: "בדיקת ספק", department: "הפצה", responsibleIds: ["u1"], priority: "medium", status: "todo" },
            { id: "task-hidden", title: "נסתר", department: "קבלה", responsibleIds: ["u2"], priority: "medium", status: "todo" }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().actions).toEqual([
      expect.objectContaining({
        id: "update_task_task-visible",
        type: "task.update",
        requiresConfirmation: true,
        writesData: false,
        execute: {
          method: "POST",
          path: "/api/work",
          resource: "tasks",
          bodyField: "task"
        },
        payload: {
          taskId: "task-visible",
          taskTitle: "בדיקת ספק",
          current: { priority: "medium" },
          patch: { priority: "high" }
        }
      })
    ]);
  });

  it("returns deterministic task responsible update proposals only from role-filtered visible users", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר להחליף אחראי לאחר אישור."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => 447,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "תעדכן את אחראי המשימה לדנה כהן",
        context: {
          users: [
            { id: "u1", name: "Vadim", workerNo: "1", department: "הפצה" },
            { id: "u2", name: "דנה כהן", workerNo: "11032", department: "הפצה", pinHash: "secret" },
            { id: "u3", name: "Hidden", workerNo: "22000", department: "קבלה" }
          ],
          tasks: [
            { id: "task-visible", title: "בדיקת ספק", department: "הפצה", responsibleIds: ["u1"], priority: "medium", status: "todo" },
            { id: "task-hidden", title: "נסתר", department: "קבלה", responsibleIds: ["u3"], priority: "medium", status: "todo" }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(providerCall.mock.calls[0][0].prompt).not.toContain("secret");
    expect(providerCall.mock.calls[0][0].prompt).not.toContain("Hidden");
    expect(res.json().actions).toEqual([
      expect.objectContaining({
        id: "update_task_task-visible",
        type: "task.update",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          taskId: "task-visible",
          taskTitle: "בדיקת ספק",
          current: { responsibleIds: ["u1"] },
          patch: { responsibleIds: ["u2"] },
          display: {
            responsibleIds: {
              before: ["Vadim"],
              after: ["דנה כהן"]
            }
          }
        }
      })
    ]);
  });

  it("returns deterministic task due-date update proposals from explicit relative dates", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר לעדכן את תאריך היעד לאחר אישור."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => 5000,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "תעדכן את המשימה למחר",
        context: {
          tasks: [
            { id: "task-visible", title: "בדיקת ספק", department: "הפצה", responsibleIds: ["u1"], priority: "medium", status: "todo", dueAt: null },
            { id: "task-hidden", title: "נסתר", department: "קבלה", responsibleIds: ["u2"], priority: "medium", status: "todo", dueAt: null }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().actions).toEqual([
      expect.objectContaining({
        id: "update_task_task-visible",
        type: "task.update",
        payload: {
          taskId: "task-visible",
          taskTitle: "בדיקת ספק",
          current: { dueAt: null },
          patch: { dueAt: 5000 + 86400000 }
        }
      })
    ]);
  });

  it("returns deterministic task due-date update proposals from explicit calendar dates", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר לעדכן את תאריך היעד לאחר אישור."
    });
    const now = new Date(2026, 6, 13, 12, 34).getTime();
    const expectedDueAt = new Date(2026, 6, 15, 12, 34).getTime();
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => now,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "תעדכן את המשימה ל-15.07.26",
        context: {
          tasks: [
            { id: "task-visible", title: "בדיקת ספק", department: "הפצה", responsibleIds: ["u1"], priority: "medium", status: "todo", dueAt: null },
            { id: "task-hidden", title: "נסתר", department: "קבלה", responsibleIds: ["u2"], priority: "medium", status: "todo", dueAt: null }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().actions).toEqual([
      expect.objectContaining({
        id: "update_task_task-visible",
        type: "task.update",
        payload: {
          taskId: "task-visible",
          taskTitle: "בדיקת ספק",
          current: { dueAt: null },
          patch: { dueAt: expectedDueAt }
        }
      })
    ]);
  });

  it("returns deterministic meeting.update proposals from a single role-filtered meeting context", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר לעדכן את מועד הפגישה לאחר אישור."
    });
    const now = new Date(2026, 6, 13, 12, 34).getTime();
    const currentAt = new Date(2026, 6, 13, 15, 0).getTime();
    const expectedAt = new Date(2026, 6, 14, 10, 30).getTime();
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => now,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "תעדכן את הפגישה למחר ב-10:30",
        context: {
          meetings: [
            { id: "meeting-visible", title: "ישיבת בטיחות", department: "הפצה", participantIds: ["u1"], status: "planned", at: currentAt },
            { id: "meeting-hidden", title: "נסתר", department: "קבלה", participantIds: ["u2"], status: "planned", at: currentAt }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().actions).toEqual([
      expect.objectContaining({
        id: "update_meeting_meeting-visible",
        type: "meeting.update",
        requiresConfirmation: true,
        writesData: false,
        execute: {
          method: "POST",
          path: "/api/work",
          resource: "meetings",
          bodyField: "meeting"
        },
        payload: {
          meetingId: "meeting-visible",
          meetingTitle: "ישיבת בטיחות",
          current: { at: currentAt },
          patch: { at: expectedAt }
        }
      })
    ]);
  });

  it("returns deterministic meeting.update proposals from explicit calendar dates", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר לעדכן את מועד הפגישה לאחר אישור."
    });
    const now = new Date(2026, 6, 13, 12, 34).getTime();
    const currentAt = new Date(2026, 6, 13, 15, 0).getTime();
    const expectedAt = new Date(2026, 6, 16, 9, 15).getTime();
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => now,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "תעדכן את הפגישה ל-16/07/2026 בשעה 09:15",
        context: {
          meetings: [
            { id: "meeting-visible", title: "ישיבת בטיחות", department: "הפצה", participantIds: ["u1"], status: "planned", at: currentAt },
            { id: "meeting-hidden", title: "נסתר", department: "קבלה", participantIds: ["u2"], status: "planned", at: currentAt }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().actions).toEqual([
      expect.objectContaining({
        id: "update_meeting_meeting-visible",
        type: "meeting.update",
        payload: {
          meetingId: "meeting-visible",
          meetingTitle: "ישיבת בטיחות",
          current: { at: currentAt },
          patch: { at: expectedAt }
        }
      })
    ]);
  });

  it("passes only role-filtered assistant context to the provider prompt", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "anthropic",
      model: "claude-test",
      text: "נמצאה קריאה אחת בתחום שלך."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", department: "הפצה", departments: ["הפצה"] }),
      providerCall,
      now: () => 321,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "מה פתוח אצלי?",
        workflow: "sla_explanation",
        context: {
          metrics: { openTickets: 2, totalCost: 5000 },
          bi: {
            heatmap: [
              { department: "הפצה", total: 1, primaryRisk: { key: "sla", label: "SLA", value: 1 } },
              { department: "קבלה", total: 1, primaryRisk: { key: "critical", label: "השבתה", value: 1 } }
            ]
          },
          tickets: [
            { id: "visible", subject: "Allowed", department: "הפצה", cost: 1000 },
            { id: "hidden", subject: "Hidden", department: "קבלה", cost: 4000 }
          ],
          tasks: [
            { id: "task-visible", title: "Allowed task", department: "הפצה", responsibleIds: ["u1"], dueDays: -1, overdue: true },
            { id: "task-hidden", title: "Hidden task", department: "קבלה", responsibleIds: ["u2"] }
          ],
          meetings: [
            { id: "meeting-visible", title: "Allowed meeting", department: "הפצה", participantIds: ["u1"], needsSummary: true },
            { id: "meeting-hidden", title: "Hidden meeting", department: "קבלה", participantIds: ["u2"] }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const prompt = JSON.parse(providerCall.mock.calls[0][0].prompt);
    expect(prompt.context.metrics).toEqual({ openTickets: 2 });
    expect(prompt.workflow).toMatchObject({
      id: "sla_explanation",
      instruction: expect.stringContaining("SLA")
    });
    expect(prompt.roleGuidance).toContain("department manager");
    expect(prompt.context.profile.capabilities).toMatchObject({
      supplierRouting: false,
      companyScope: false,
      financials: false
    });
    expect(prompt.capabilityGuidance).toEqual(expect.arrayContaining([
      expect.stringContaining("cannot choose or change the supplier"),
      expect.stringContaining("inside their visible department/user scope")
    ]));
    expect(prompt.context.bi.heatmap).toEqual([
      expect.objectContaining({
        department: "הפצה",
        primaryRisk: { key: "sla", label: "SLA", value: 1 }
      })
    ]);
    expect(prompt.context.tickets.map((ticket) => ticket.id)).toEqual(["visible"]);
    expect(prompt.context.tickets[0]).not.toHaveProperty("cost");
    expect(prompt.context.tasks.map((task) => task.id)).toEqual(["task-visible"]);
    expect(prompt.context.meetings.map((meeting) => meeting.id)).toEqual(["meeting-visible"]);
    expect(JSON.stringify(prompt)).not.toContain("Hidden");
    expect(JSON.stringify(prompt)).not.toContain("Hidden task");
    expect(JSON.stringify(prompt)).not.toContain("Hidden meeting");
  });

  it("passes the current user request and recent conversation explicitly to the provider prompt", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.5-flash",
      text: "אענה לפי השאלה הנוכחית."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 654,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "תענה רק על מצב הניקיון",
        workflow: "general",
        messages: [
          { role: "assistant", content: "ברוך הבא" },
          { role: "user", content: "מה קורה במסמכי צי?" },
          { role: "assistant", content: "יש התראות מסמכים." },
          { role: "user", content: "תענה רק על מצב הניקיון" }
        ],
        context: {
          metrics: { cleaningOpenComplaints: 3, fleetDocumentAlerts: 15 },
          tickets: []
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const prompt = JSON.parse(providerCall.mock.calls[0][0].prompt);
    expect(prompt.userRequest).toBe("תענה רק על מצב הניקיון");
    expect(prompt.recentConversation).toEqual([
      { role: "user", content: "מה קורה במסמכי צי?" },
      { role: "assistant", content: "[previous assistant reply omitted; answer the current userRequest]" },
      { role: "user", content: "תענה רק על מצב הניקיון" }
    ]);
    expect(prompt.contract.expectedOutput).toContain("answer the current userRequest first");
  });

  it("tells the provider not to repeat stale operational summaries for unrelated latest messages", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.5-flash",
      text: "Могу помочь с заявками, техникой, уборкой, одеждой, задачами и настройками."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "admin" }),
      providerCall,
      now: () => 655,
      rateBuckets: new Map()
    });

    const staleSummary = "קיימות 15 התראות מסמכי צי רכב פתוחות. בנוסף, קיימת קריאת שירות אחת באיחור.";
    const res = await call(handler, {
      body: {
        text: "что ты умеешь?",
        workflow: "general",
        messages: [
          { role: "assistant", content: staleSummary },
          { role: "user", content: "что ты умеешь?" }
        ],
        context: {
          metrics: { fleetDocumentAlerts: 15, overdueTickets: 1 },
          tickets: [{ id: "F-002", subject: "ידית דלת מקרר", overdue: true }],
          fleet: { docs: [{ id: "doc-6954052", unitCode: "6954052", title: "חסר תוקף", daysLeft: -1 }] }
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const prompt = JSON.parse(providerCall.mock.calls[0][0].prompt);
    expect(prompt.userRequest).toBe("что ты умеешь?");
    expect(prompt.latestMessageGuidance).toMatchObject({
      priority: "latest_user_message",
      operationalDigestAllowed: false
    });
    expect(JSON.stringify(prompt)).not.toContain(staleSummary);
    expect(prompt.recentConversation).toEqual([
      { role: "user", content: "что ты умеешь?" }
    ]);
    expect(prompt.latestMessageGuidance.instruction).toContain("Do not repeat an older assistant answer");
    expect(prompt.latestMessageGuidance.staleSummaryRule).toContain("Do not summarize fleet document alerts");
    expect(prompt.assistantCapabilities.instruction).toContain("do not say you cannot create or update records");
    expect(prompt.assistantCapabilities.instruction).toContain("for human confirmation");
    expect(prompt.assistantCapabilities.canPrepare).toEqual(expect.arrayContaining([
      "ticket.create",
      "task.create",
      "ppe.request.create",
      "cleaning.complaint.create"
    ]));
    expect(prompt.roleGuidance).toContain("answer the latest user request first");
    expect(prompt.roleGuidance).toContain("Only when the latest request asks for status");
  });

  it("uses a short latest clarification with the previous actionable request for deterministic draft actions", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.5-flash",
      text: "Подготовил карточку заявки для подтверждения."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "admin" }),
      providerCall,
      now: () => 656,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "в холодильной комнате F-002",
        language: "ru",
        workflow: "general",
        messages: [
          { role: "user", content: "создай заявку: сломалась ручка двери холодильника" },
          { role: "assistant", content: "Где именно это находится?" },
          { role: "user", content: "в холодильной комнате F-002" }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.draft.rawText).toBe("создай заявку: сломалась ручка двери холодильника. в холодильной комнате F-002");
    expect(payload.draft.signals).toMatchObject({
      hasExactLocation: true,
      locationHint: "холодильной комнате F-002"
    });
    expect(payload.actions).toEqual([
      expect.objectContaining({
        type: "ticket.create",
        status: "needs_form_review",
        missingFields: ["priority"],
        payload: expect.objectContaining({
          track: "facility",
          zone: "холодильной комнате F-002",
          description: "создай заявку: сломалась ручка двери холодильника. в холодильной комнате F-002"
        })
      })
    ]);

    const prompt = JSON.parse(providerCall.mock.calls[0][0].prompt);
    expect(prompt.userRequest).toBe("в холодильной комнате F-002");
    expect(prompt.draftInput).toEqual({
      rawText: "создай заявку: сломалась ручка двери холодильника. в холодильной комнате F-002",
      mergedFromRecentConversation: true
    });
    expect(prompt.latestMessageGuidance.operationalDigestAllowed).toBe(false);
    expect(prompt.actionGuidance).toMatchObject({
      hasActionProposal: true,
      readyActionCount: 0,
      reviewInFormCount: 1,
      missingFields: ["priority"]
    });
  });

  it("uses a deterministic missing-location question for inline facility ticket intake", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.5-flash",
      text: "היי, אני יכול להכין עבורך טיוטה לפתיחת קריאת שירות על המזגן"
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user" }),
      providerCall,
      now: () => 656,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "המזגן במחסן לא עובד",
        language: "he",
        workflow: "ticket_intake",
        context: {
          intent: "create_ticket",
          uiSurface: "inline_ticket_create",
          taskSession: { type: "ticket_intake", transient: true }
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.assistant.text).toBe("באיזה אזור או מחלקה נמצאת התקלה?");
    expect(payload.actions).toEqual([
      expect.objectContaining({
        type: "ticket.create",
        status: "needs_human_input",
        missingFields: expect.arrayContaining(["zone"]),
        payload: expect.objectContaining({
          track: "facility",
          zone: ""
        })
      })
    ]);
  });

  it("uses a natural location question for inline facility ticket intake without exposing field keys", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.5-flash",
      text: "אפשר להכין טיוטת קריאה"
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user" }),
      providerCall,
      now: () => 656,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "מזגן לא עובד בחדר מפעיל מערכת",
        language: "he",
        workflow: "ticket_intake",
        context: {
          intent: "create_ticket",
          uiSurface: "inline_ticket_create",
          taskSession: { type: "ticket_intake", transient: true }
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.assistant.text).toBe("באיזה אזור או מחלקה נמצאת התקלה?");
    expect(payload.assistant.text).not.toContain("zone");
    expect(payload.actions[0]).toMatchObject({
      type: "ticket.create",
      status: "needs_human_input",
      missingFields: ["priority", "zone"],
      payload: {
        track: "facility",
        category: "hvac",
        priority: "",
        zone: ""
      }
    });
  });

  it("uses the pinned latest location answer to complete a prior inline facility ticket intake", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.5-flash",
      text: "הטיוטה מוכנה להשלמה בטופס הקריאה. האם תרצה לצרף תמונה?"
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user" }),
      providerCall,
      now: () => 657,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "משרדי הפצה",
        language: "he",
        workflow: "ticket_intake",
        messages: [
          { role: "assistant", content: "תארו בקצרה מה קרה. אפשר לציין מספר כלי, אזור או ציוד." },
          { role: "user", content: "מזגן לא עובד בחדר מפעיל מערכת" },
          { role: "assistant", content: "באיזה אזור או מחלקה נמצאת התקלה?" },
          { role: "user", content: "משרדי הפצה" }
        ],
        context: {
          intent: "create_ticket",
          uiSurface: "inline_ticket_create",
          taskSession: {
            type: "ticket_intake",
            transient: true,
            intake: {
              domain: "facility",
              pendingField: "location",
              status: "pending",
              draft: {
                track: "facility",
                subject: "מזגן לא עובד בחדר מפעיל מערכת",
                category: "hvac",
                priority: "medium",
                zone: "",
                description: "דווח כי המזגן בחדר מפעיל המערכת אינו עובד. יש לבדוק את התקלה."
              }
            }
          }
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.draft.rawText).toBe("מזגן לא עובד בחדר מפעיל מערכת. באזור משרדי הפצה");
    expect(payload.draft.module).toBe("facility");
    expect(payload.assistant.text).toContain("priority");
    expect(payload.assistant.text).not.toContain("כלי");
    expect(payload.assistant.text).not.toContain("מלגזה");
    expect(payload.assistant.text).not.toContain("תמונה");
    expect(payload.actions[0]).toMatchObject({
      type: "ticket.create",
      status: "needs_form_review",
      missingFields: ["priority"],
      payload: {
        track: "facility",
        category: "hvac",
        priority: "",
        zone: "משרדי הפצה",
        subject: "מזגן לא עובד בחדר מפעיל מערכת"
      }
    });
    expect(payload.actions[0].payload.description).not.toBe(payload.actions[0].payload.subject);
    const prompt = JSON.parse(providerCall.mock.calls[0][0].prompt);
    expect(prompt.draftInput).toMatchObject({
      rawText: "מזגן לא עובד בחדר מפעיל מערכת. באזור משרדי הפצה",
      mergedFromRecentConversation: true
    });
  });

  it("resolves a follow-up facility location fragment inside the previously offered candidate set", async () => {
    const providerCall = vi.fn();
    const ticketsDriver = {
      create: vi.fn().mockResolvedValue({
        ticketId: "ticket-office-distribution",
        num: 43,
        ticketNo: "F-043",
        status: "new",
        idempotencyStatus: "created"
      })
    };
    const appConfigDriver = {
      get: vi.fn().mockResolvedValue({
        config: {
          categories: [{ id: "hvac", label: "מיזוג אוויר" }],
          zones: ["משרדי הפצה", "רחבת הפצה", "קבלה"]
        }
      })
    };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      appConfigDriver,
      providerCall,
      now: () => 658,
      rateBuckets: new Map()
    });

    const ambiguous = await call(handler, {
      body: inlineTicketBody({
        text: "מזגן לא עובד בחדר מפעיל מערכת. באזור הפצה. עדיפות בינונית",
        idempotencyKey: "idem-location-ambiguous",
        context: { tickets: [] }
      })
    });
    expect(ambiguous.statusCode).toBe(200);
    expect(ambiguous.json().assistant.text).toContain("משרדי הפצה");
    expect(ambiguous.json().assistant.text).toContain("רחבת הפצה");
    const pending = ambiguous.json().capabilityResponse.intake;

    const selected = await call(handler, {
      body: inlineTicketBody({
        text: "משרדים",
        idempotencyKey: "idem-location-ambiguous",
        messages: [
          { role: "user", content: "מזגן לא עובד בחדר מפעיל מערכת. עדיפות בינונית" },
          { role: "assistant", content: ambiguous.json().assistant.text },
          { role: "user", content: "משרדים" }
        ],
        context: {
          tickets: [],
          taskSession: {
            intake: pending
          }
        }
      })
    });

    expect(selected.statusCode).toBe(200);
    expect(selected.json().capabilityResponse).toMatchObject({
      executionStatus: "created",
      actionResult: {
        ticketId: "ticket-office-distribution",
        track: "facility",
        zone: "משרדי הפצה",
        category: "hvac"
      }
    });
    expect(selected.json().assistant.text).not.toContain("כלי");
    expect(selected.json().assistant.text).not.toContain("מלגזה");
    expect(providerCall).not.toHaveBeenCalled();
    expect(ticketsDriver.create).toHaveBeenCalledTimes(1);
  });

  it("does not merge a short non-operational latest message into an older action request", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.5-flash",
      text: "Пожалуйста."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "admin" }),
      providerCall,
      now: () => 657,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "спасибо",
        language: "ru",
        messages: [
          { role: "user", content: "создай заявку: сломалась ручка двери холодильника" },
          { role: "assistant", content: "Где именно это находится?" },
          { role: "user", content: "спасибо" }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.draft.rawText).toBe("спасибо");
    expect(payload.actions).toEqual([]);

    const prompt = JSON.parse(providerCall.mock.calls[0][0].prompt);
    expect(prompt.userRequest).toBe("спасибо");
    expect(prompt.draftInput).toEqual({
      rawText: "спасибо",
      mergedFromRecentConversation: false
    });
  });

  it("writes safe learning telemetry for conversation-merged assistant actions", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.5-flash",
      text: "Подготовил карточку заявки для подтверждения."
    });
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "admin" }),
      providerCall,
      auditDriver,
      now: () => 658,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "в холодильной комнате F-002",
        language: "ru",
        messages: [
          { role: "user", content: "создай заявку: сломалась ручка двери холодильника" },
          { role: "assistant", content: "Где именно это находится?" },
          { role: "user", content: "в холодильной комнате F-002" }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      at: 658,
      action: "ai_assist",
      metadata: expect.objectContaining({
        provider: "google",
        model: "gemini-3.5-flash",
        providerStatus: "ok",
        requestedLanguage: "ru",
        requestedLanguageSource: "latest_user_message",
        assistantLanguage: "ru",
        languageMismatch: false,
        actionCount: 1,
        readyActionCount: 0,
        missingFieldCount: 1,
        actionTypes: ["ticket.create"],
        missingFields: ["priority"],
        intakeTelemetry: {
          mergedFromRecentConversation: true,
          recentConversationCount: 3,
          latestUserMessageChars: "в холодильной комнате F-002".length,
          draftInputChars: "создай заявку: сломалась ручка двери холодильника. в холодильной комнате F-002".length
        }
      })
    }));
    const auditPayload = JSON.stringify(auditDriver.write.mock.calls[0][0]);
    expect(auditPayload).not.toContain("сломалась ручка");
    expect(auditPayload).not.toContain("холодильной комнате");
    expect(auditPayload).not.toContain("server-secret");
  });

  it("answers in the latest user message language instead of the UI fallback language", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.1-flash-lite",
      text: "Понял вопрос."
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 602,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "Почему уведомления повторяются каждые несколько минут?",
        language: "he",
        messages: [
          { role: "assistant", content: "שלום, איך אפשר לעזור?" },
          { role: "user", content: "Почему уведомления повторяются каждые несколько минут?" }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    const callArg = providerCall.mock.calls[0][0];
    const prompt = JSON.parse(callArg.prompt);
    expect(prompt.responseLanguage).toEqual({
      code: "ru",
      name: "Russian",
      source: "latest_user_message"
    });
    expect(prompt.contract.expectedOutput).toContain("Answer in Russian");
    expect(prompt.contract.languagePolicy).toContain("Output language is locked to Russian");
    expect(prompt.contract.languagePolicy).toContain("Never answer in English unless responseLanguage.code is \"en\"");
    expect(prompt.contract.formatPolicy).toContain("short paragraphs");
    expect(prompt.contract.tonePolicy).toContain("calm human colleague");
    expect(callArg.system).toContain("Reply in the latest user message language");
    expect(callArg.system).toContain("Never switch to English unless the latest user message is English");
    expect(callArg.system).toContain("calm human colleague");
  });

  it("preserves assistant paragraph breaks for readable UI output", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.1-flash-lite",
      text: "Короткий ответ.\n\nЧто важно:\n- пункт один\n- пункт два"
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 603,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "Покажи кратко, что важно",
        language: "ru"
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.text).toBe("Короткий ответ.\n\nЧто важно:\n- пункт один\n- пункт два");
  });

  it("writes an audit-safe AI assist event for provider calls", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "תשובה קצרה."
    });
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ role: "admin", department: "הנהלה", departments: ["הנהלה"] }),
      providerCall,
      auditDriver,
      now: () => 777,
      rateBuckets: new Map()
    });

    const res = await call(handler, {
      body: {
        text: "טקסט רגיש שלא אמור להיכנס ליומן",
        context: {
          tickets: [{ id: "t1", subject: "נושא רגיש", department: "הנהלה" }],
          metrics: { openTickets: 1, totalCost: 10 }
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      at: 777,
      actorId: "u1",
      entityType: "system",
      entityId: "ai-assist",
      action: "ai_assist",
      metadata: expect.objectContaining({
        provider: "openai",
        model: "gpt-5.2",
        providerStatus: "ok",
        workflow: "general",
        requestedLanguage: "he",
        requestedLanguageSource: "latest_user_message",
        assistantLanguage: "he",
        languageMismatch: false,
        actionCount: 0,
        readyActionCount: 0,
        missingFieldCount: 0,
        contextCounts: { tickets: 1, fleet: 0, pm: 0, tasks: 0, meetings: 0, metrics: 2 }
      })
    }));
    const auditPayload = JSON.stringify(auditDriver.write.mock.calls[0][0]);
    expect(auditPayload).not.toContain("טקסט רגיש");
    expect(auditPayload).not.toContain("נושא רגיש");
    expect(auditPayload).not.toContain("server-secret");
  });

  it("writes a failed provider audit event before returning provider failure", async () => {
    const providerCall = vi.fn().mockResolvedValue({ ok: false, error: "provider_down" });
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      providerCall,
      auditDriver,
      now: () => 888,
      rateBuckets: new Map()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(502);
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      at: 888,
      action: "ai_assist",
      metadata: expect.objectContaining({
        provider: "anthropic",
        providerStatus: "failed",
        workflow: "general",
        requestedLanguage: "he",
        requestedLanguageSource: "latest_user_message",
        actionCount: 1
      })
    }));
  });

  it("rate limits repeated assistant requests per authenticated user", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "anthropic",
      model: "claude-test",
      text: "טיוטה"
    });
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "server-secret",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "10000"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 5000,
      rateBuckets: new Map()
    });

    const first = await call(handler);
    const second = await call(handler);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(second.json()).toEqual({ error: "ai_assist_rate_limited" });
    expect(providerCall).toHaveBeenCalledTimes(1);
  });

  it("applies a server-side inline ticket create burst guard without using the provider bucket", async () => {
    const providerCall = vi.fn();
    const ticketsDriver = {
      create: vi.fn()
        .mockResolvedValueOnce({
          ticketId: "ticket-226-a",
          num: 2261,
          ticketNo: "T-2261",
          status: "new",
          idempotencyStatus: "created"
        })
        .mockResolvedValueOnce({
          ticketId: "ticket-226-a",
          num: 2261,
          ticketNo: "T-2261",
          status: "new",
          idempotencyStatus: "replayed"
        })
    };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "10000",
        CMMS_AI_INLINE_TICKET_CREATE_RATE_LIMIT_MS: "10000"
      },
      sessionClient: sessionClient({ role: "user", permissions: autonomyPermission }),
      ticketsDriver,
      providerCall,
      now: () => 5000,
      rateBuckets: new Map()
    });

    const first = await call(handler, {
      body: inlineTicketBody({
        text: "במלגזה 226 תקלה בבדיקה, עדיפות בינונית",
        idempotencyKey: "inline-rate-a",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      })
    });
    const replay = await call(handler, {
      body: inlineTicketBody({
        text: "במלגזה 226 תקלה בבדיקה, עדיפות בינונית",
        idempotencyKey: "inline-rate-a",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      })
    });
    const burst = await call(handler, {
      body: inlineTicketBody({
        text: "במלגזה 226 תקלה נוספת בבדיקה, עדיפות בינונית",
        idempotencyKey: "inline-rate-b",
        context: { fleet: [{ id: "forklift-226", code: "226", department: "הפצה" }], tickets: [] }
      })
    });

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(burst.statusCode).toBe(200);
    expect(first.json().capabilityResponse.executionStatus).toBe("created");
    expect(replay.json().capabilityResponse.executionStatus).toBe("replayed");
    expect(burst.json().capabilityResponse).toMatchObject({
      executionStatus: "blocked",
      unknowns: ["inline_ticket_create_rate_limited"]
    });
    expect(ticketsDriver.create).toHaveBeenCalledTimes(2);
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("handles invalid JSON without leaking internals", async () => {
    async function* body() {
      yield Buffer.from("{bad");
    }
    const handler = createAiAssistHandler({
      sessionClient: sessionClient(),
      now: () => 9000,
      rateBuckets: new Map()
    });
    const res = createRes();
    await handler({
      method: "POST",
      headers: { authorization: "Bearer token" },
      [Symbol.asyncIterator]: body
    }, res);

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid_json" });
  });
});
