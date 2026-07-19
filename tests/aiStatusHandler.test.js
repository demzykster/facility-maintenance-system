import { describe, expect, it, vi } from "vitest";
import { createAiStatusHandler } from "../server/ai/statusHandler.js";

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
      ...profile
    })
  };
}

async function call(handler, req = {}) {
  const res = createRes();
  await handler({
    method: "GET",
    headers: { authorization: "Bearer token" },
    ...req
  }, res);
  return res;
}

describe("AI status handler", () => {
  it("requires GET and an authenticated session", async () => {
    const handler = createAiStatusHandler();

    const postRes = await call(handler, { method: "POST" });
    expect(postRes.statusCode).toBe(405);
    expect(postRes.headers.allow).toBe("GET");

    const unauthRes = await call(handler, { headers: {} });
    expect(unauthRes.statusCode).toBe(401);
    expect(unauthRes.json()).toEqual({ error: "access_token_required" });
  });

  it("returns public server AI readiness without leaking provider keys", async () => {
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        CMMS_AI_MODEL: "gpt-5.2",
        OPENAI_API_KEY: "server-secret"
      },
      sessionClient: sessionClient()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload).toMatchObject({
      ok: true,
      ai: {
        mode: "server",
        provider: "openai",
        model: "gpt-5.2",
        providerKeyConfigured: true,
        serverReady: true,
        capabilities: {
          autonomousTicketCreate: false
        },
        memory: {
          globalEnabled: false,
          pilotMember: false,
          effectiveAccess: false
        },
        conversations: {
          globalEnabled: false,
          pilotMember: false,
          effectiveAccess: false
        },
        ticketCreate: {
          autonomousConfigured: false,
          serverCreate: {
            configured: false,
            dependency: "disabled",
            ready: false,
            disabledReason: "ticket_server_create_v2_disabled"
          },
          capability: {
            disabled: true,
            ready: false,
            disabledReason: "autonomous_ticket_create_disabled"
          }
        },
        supportedProviderOptions: [
          expect.objectContaining({ id: "anthropic", label: expect.stringContaining("Claude") }),
          expect.objectContaining({ id: "google", label: expect.stringContaining("Gemini") }),
          expect.objectContaining({ id: "openai", label: expect.stringContaining("Codex") })
        ],
        errors: []
      }
    });
    expect(JSON.stringify(payload)).not.toContain("server-secret");
  });

  it("reports effective memory access without exposing memory text or secrets", async () => {
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_MEMORY_PILOT: "true",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret"
      },
      sessionClient: sessionClient({ role: "user", permissions: { aiMemoryPilot: "request" } })
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(res.json().ai.memory).toEqual({
      globalEnabled: true,
      pilotMember: true,
      effectiveAccess: true
    });
    expect(JSON.stringify(res.json())).not.toContain("server-secret");
  });

  it("reports effective durable conversation access without exposing other users", async () => {
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_CONVERSATIONS_PILOT: "true",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret"
      },
      sessionClient: sessionClient({ role: "user", permissions: { aiConversationsPilot: "request" } })
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(res.json().ai.conversations).toEqual({
      globalEnabled: true,
      pilotMember: true,
      effectiveAccess: true
    });
    expect(JSON.stringify(res.json())).not.toContain("server-secret");
    expect(JSON.stringify(res.json())).not.toContain("other");
  });

  it("does not grant durable conversation access from role alone", async () => {
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_CONVERSATIONS_PILOT: "true",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret"
      },
      sessionClient: sessionClient({ role: "admin", permissions: {} })
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(res.json().ai.conversations).toEqual({
      globalEnabled: true,
      pilotMember: false,
      effectiveAccess: false
    });
  });

  it("keeps autonomous ticket create disabled when server-create cutover is off", async () => {
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_APP_MODE: "local"
      },
      sessionClient: sessionClient()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(res.json().ai).toMatchObject({
      capabilities: { autonomousTicketCreate: false },
      ticketCreate: {
        autonomousConfigured: true,
        serverCreate: {
          configured: false,
          dependency: "disabled",
          ready: false,
          disabledReason: "ticket_server_create_v2_disabled"
        },
        capability: {
          disabled: true,
          ready: false,
          disabledReason: "ticket_server_create_v2_disabled"
        }
      }
    });
  });

  it("reports autonomous ticket create ready only when AI and server-create are both ready", async () => {
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_TICKET_SERVER_CREATE_V2_READY: "local",
        CMMS_APP_MODE: "local"
      },
      ticketsDriver: { create: vi.fn() },
      sessionClient: sessionClient()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(res.json().ai).toMatchObject({
      capabilities: { autonomousTicketCreate: true },
      ticketCreate: {
        autonomousConfigured: true,
        serverCreate: {
          configured: true,
          dependency: "configured",
          ready: true,
          disabledReason: ""
        },
        capability: {
          disabled: false,
          ready: true,
          disabledReason: ""
        }
      }
    });
  });

  it("reports unavailable dependency when cutover is configured but the create driver is missing", async () => {
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret",
        CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
        CMMS_TICKET_SERVER_CREATE_V2: "local",
        CMMS_APP_MODE: "local"
      },
      ticketsDriver: {},
      sessionClient: sessionClient()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(res.json().ai).toMatchObject({
      capabilities: { autonomousTicketCreate: false },
      ticketCreate: {
        autonomousConfigured: true,
        serverCreate: {
          configured: true,
          dependency: "unavailable",
          ready: false,
          disabledReason: "ticket_create_rpc_unavailable"
        },
        capability: {
          disabled: true,
          ready: false,
          disabledReason: "ticket_create_rpc_unavailable"
        }
      }
    });
  });

  it("can run an admin-only live provider connection check without leaking keys", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "OK"
    });
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        CMMS_AI_MODEL: "gpt-5.2",
        OPENAI_API_KEY: "server-secret"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 1234
    });

    const res = await call(handler, { query: { check: "1" } });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.ai.providerCheck).toEqual({
      attempted: true,
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      checkedAt: 1234
    });
    expect(providerCall).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        provider: "openai",
        model: "gpt-5.2",
        openaiApiKey: "server-secret"
      }),
      maxTokens: 16
    }));
    expect(JSON.stringify(payload)).not.toContain("server-secret");
  });

  it("can run a Google Gemini provider connection check without leaking keys", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: true,
      provider: "google",
      model: "gemini-3.5-flash",
      text: "OK"
    });
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "gemini",
        GOOGLE_GENERATIVE_AI_API_KEY: "google-secret"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 3344
    });

    const res = await call(handler, { query: { check: "1" } });

    expect(res.statusCode).toBe(200);
    expect(res.json().ai.providerCheck).toEqual({
      attempted: true,
      ok: true,
      provider: "google",
      model: "gemini-3.5-flash",
      checkedAt: 3344
    });
    expect(providerCall).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        provider: "google",
        model: "gemini-3.5-flash",
        googleApiKey: "google-secret"
      }),
      maxTokens: 16
    }));
    expect(JSON.stringify(res.json())).not.toContain("google-secret");
  });

  it("normalizes provider quota failures during live connection checks", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: false,
      provider: "openai",
      model: "gpt-5.2",
      error: "You exceeded your current quota, please check your plan and billing details."
    });
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        CMMS_AI_MODEL: "gpt-5.2",
        OPENAI_API_KEY: "server-secret"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 2233
    });

    const res = await call(handler, { query: { check: "1" } });

    expect(res.statusCode).toBe(200);
    expect(res.json().ai.providerCheck).toMatchObject({
      attempted: true,
      ok: false,
      provider: "openai",
      model: "gpt-5.2",
      checkedAt: 2233,
      error: "ai_provider_quota_exceeded",
      detail: "You exceeded your current quota, please check your plan and billing details."
    });
    expect(JSON.stringify(res.json())).not.toContain("server-secret");
  });

  it("keeps provider failure detail short and redacted during live checks", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: false,
      provider: "google",
      model: "gemini-3.5-flash",
      error: "API key AIza_FAKE_TEST_KEY is invalid for models/gemini-3.5-flash and token=secret-value"
    });
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        CMMS_AI_MODEL: "gemini-3.5-flash",
        GOOGLE_GENERATIVE_AI_API_KEY: "google-secret"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 2234
    });

    const res = await call(handler, { query: { check: "1" } });

    expect(res.statusCode).toBe(200);
    const payload = res.json();
    expect(payload.ai.providerCheck).toMatchObject({
      attempted: true,
      ok: false,
      provider: "google",
      model: "gemini-3.5-flash",
      checkedAt: 2234,
      error: "ai_provider_model_unavailable"
    });
    expect(payload.ai.providerCheck.detail).toContain("AIza_FAKE_TEST_KEY");
    expect(payload.ai.providerCheck.detail).toContain("token=[redacted]");
    expect(JSON.stringify(payload)).not.toContain("google-secret");
    expect(JSON.stringify(payload)).not.toContain("secret-value");
  });

  it("normalizes temporary high-demand provider failures separately from model availability", async () => {
    const providerCall = vi.fn().mockResolvedValue({
      ok: false,
      provider: "google",
      model: "gemini-3.5-flash",
      error: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."
    });
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        CMMS_AI_MODEL: "gemini-3.5-flash",
        GOOGLE_GENERATIVE_AI_API_KEY: "google-secret"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 2235
    });

    const res = await call(handler, { query: { check: "1" } });

    expect(res.statusCode).toBe(200);
    expect(res.json().ai.providerCheck).toMatchObject({
      attempted: true,
      ok: false,
      provider: "google",
      model: "gemini-3.5-flash",
      checkedAt: 2235,
      error: "ai_provider_rate_limited",
      detail: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."
    });
    expect(JSON.stringify(res.json())).not.toContain("google-secret");
  });

  it("reports skipped provider checks when server AI is not ready", async () => {
    const providerCall = vi.fn();
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai"
      },
      sessionClient: sessionClient(),
      providerCall,
      now: () => 2000
    });

    const res = await call(handler, { query: { check: "1" } });

    expect(res.statusCode).toBe(200);
    expect(res.json().ai.providerCheck).toMatchObject({
      attempted: true,
      ok: false,
      provider: "openai",
      model: "gpt-5.2",
      checkedAt: 2000,
      error: "ai_provider_key_required"
    });
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("rejects live provider checks for users without full settings access", async () => {
    const providerCall = vi.fn();
    const handler = createAiStatusHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "server-secret"
      },
      sessionClient: sessionClient({ role: "user", perms: { settings: "manage" } }),
      providerCall
    });

    const res = await call(handler, { query: { check: "1" } });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "settings_full_required" });
    expect(providerCall).not.toHaveBeenCalled();
  });
});
