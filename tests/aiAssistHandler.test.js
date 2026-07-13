import { describe, expect, it, vi } from "vitest";
import { createAiAssistHandler } from "../server/ai/assistHandler.js";
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
        status: "needs_human_input",
        requiresConfirmation: true,
        writesData: false,
        missingFields: ["downtimeType"],
        payload: expect.objectContaining({
          track: "transport",
          forkliftId: "fleet-120823",
          asset: "120823",
          zone: "טעינה"
        })
      })
    ]);
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
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        missingFields: [],
        payload: expect.objectContaining({
          track: "transport",
          forkliftId: "fleet-120823",
          asset: "120823",
          downtimeType: "critical",
          priority: "high"
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
      { role: "assistant", content: "יש התראות מסמכים." },
      { role: "user", content: "תענה רק על מצב הניקיון" }
    ]);
    expect(prompt.contract.expectedOutput).toContain("answer the current userRequest first");
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
        workflow: "general"
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
