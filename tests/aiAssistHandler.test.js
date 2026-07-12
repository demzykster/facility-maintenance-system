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
