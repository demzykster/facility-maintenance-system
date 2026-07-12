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
});
