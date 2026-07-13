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
