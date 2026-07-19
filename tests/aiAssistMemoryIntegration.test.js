import { describe, expect, it, vi } from "vitest";
import { createAiAssistHandler } from "../server/ai/assistHandler.js";

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
    getAuthUser: vi.fn().mockResolvedValue({ id: "auth-1", email: "owner@example.com" }),
    getAppUserProfile: vi.fn().mockResolvedValue({
      id: "u1",
      auth_user_id: "auth-1",
      active: true,
      role: "user",
      name: "Owner",
      department: "Ops",
      departments: ["Ops"],
      ...profile
    })
  };
}

async function call(handler, body = {}) {
  const res = createRes();
  await handler({
    method: "POST",
    headers: { authorization: "Bearer token", "x-request-id": "req-assist-memory" },
    body: {
      text: "מה חשוב לזכור?",
      context: { tickets: [], fleet: [] },
      ...body
    }
  }, res);
  return res;
}

describe("AI assist memory integration", () => {
  it("audits memory proposals before human confirmation without storing the full raw prompt", async () => {
    const providerCall = vi.fn(async () => ({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: "אפשר לשמור את זה אחרי אישור."
    }));
    const auditDriver = { write: vi.fn(async () => {}) };
    const memoryStore = { list: vi.fn(async () => []), create: vi.fn(async () => ({})) };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MEMORY_PILOT: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ id: "u1", role: "user", departments: ["Ops"] }),
      memoryStore,
      fleetDriver: { list: vi.fn(async () => []) },
      auditDriver,
      providerCall,
      now: () => 2500,
      rateBuckets: new Map()
    });

    const res = await call(handler, { text: "Запомни: synthetic maintenance window is Sunday 09:00. secret=SHOULD_NOT_APPEAR" });

    expect(res.statusCode).toBe(200);
    expect(memoryStore.create).not.toHaveBeenCalled();
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "memory",
      action: "propose",
      metadata: expect.objectContaining({ outcome: "proposed", requestId: "req-assist-memory" })
    }));
    const proposalAudit = auditDriver.write.mock.calls.find(([event]) => event.entityType === "memory" && event.action === "propose")?.[0];
    expect(JSON.stringify(proposalAudit)).not.toContain("SHOULD_NOT_APPEAR");
  });

  it("adds only scoped active memory facts to the server provider prompt and audits use", async () => {
    const providerCall = vi.fn(async ({ prompt }) => ({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: JSON.parse(prompt).context.memory.facts.map((fact) => fact.id).join(",")
    }));
    const auditDriver = { write: vi.fn(async () => {}) };
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MEMORY_PILOT: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ id: "u1", role: "user", departments: ["Ops"] }),
      memoryStore: {
        list: vi.fn(async () => [
          { id: "own", scopeType: "personal", scopeId: "u1", status: "active", summary: "Own fact" },
          { id: "dept", scopeType: "department", scopeId: "Ops", status: "active", summary: "Ops fact" },
          { id: "other", scopeType: "department", scopeId: "Finance", status: "active", summary: "Finance fact" }
        ])
      },
      fleetDriver: { list: vi.fn(async () => []) },
      auditDriver,
      providerCall,
      now: () => 3000,
      rateBuckets: new Map()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.text).toBe("own,dept");
    const prompt = JSON.parse(providerCall.mock.calls[0][0].prompt);
    expect(prompt.context.memory.facts.map((fact) => fact.id)).toEqual(["own", "dept"]);
    expect(JSON.stringify(prompt.context.memory)).not.toContain("Finance fact");
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "memory",
      action: "use",
      metadata: expect.objectContaining({ requestId: "req-assist-memory", usedFactIds: ["own", "dept"] })
    }));
  });

  it("does not retrieve memory when the pilot flag is off", async () => {
    const memoryStore = { list: vi.fn(async () => [{ id: "own", scopeType: "personal", scopeId: "u1", status: "active", summary: "Own fact" }]) };
    const providerCall = vi.fn(async ({ prompt }) => ({
      ok: true,
      provider: "openai",
      model: "gpt-5.2",
      text: JSON.stringify(JSON.parse(prompt).context.memory || null)
    }));
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      memoryStore,
      fleetDriver: { list: vi.fn(async () => []) },
      providerCall,
      now: () => 4000,
      rateBuckets: new Map()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(res.json().assistant.text).toBe("null");
    expect(memoryStore.list).not.toHaveBeenCalled();
  });
});
