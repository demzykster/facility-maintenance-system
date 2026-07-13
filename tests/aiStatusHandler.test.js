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
        supportedProviderOptions: [
          expect.objectContaining({ id: "anthropic", label: expect.stringContaining("Claude") }),
          expect.objectContaining({ id: "openai", label: expect.stringContaining("Codex") })
        ],
        errors: []
      }
    });
    expect(JSON.stringify(payload)).not.toContain("server-secret");
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
      maxTokens: 8
    }));
    expect(JSON.stringify(payload)).not.toContain("server-secret");
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
