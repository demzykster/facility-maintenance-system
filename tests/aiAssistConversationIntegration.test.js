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

function conversationStore({ ownerUserId = "u1", messages = [] } = {}) {
  const savedMessages = [...messages];
  return {
    savedMessages,
    getMine: vi.fn(async ({ id, ownerUserId: requestedOwner }) => (
      id === "conv-1" && requestedOwner === ownerUserId
        ? { id: "conv-1", ownerUserId, title: "Ops", status: "active" }
        : null
    )),
    appendMessage: vi.fn(async (message) => {
      const replayed = savedMessages.find((item) => item.idempotencyKey && item.idempotencyKey === message.idempotencyKey && item.role === message.role);
      if (replayed) return { message: replayed, action: "replayed" };
      const next = { ...message, sequence: savedMessages.length + 1 };
      savedMessages.push(next);
      return { message: next, action: "created" };
    }),
    listMessages: vi.fn(async () => savedMessages),
    buildRecentHistory: vi.fn(async ({ limit = 8 } = {}) => savedMessages.slice(-limit).map((item) => ({ role: item.role, content: item.content })))
  };
}

async function call(handler, body = {}) {
  const res = createRes();
  await handler({
    method: "POST",
    headers: { authorization: "Bearer token", "x-request-id": "req-conv" },
    body: {
      text: "continue from stored history",
      conversationId: "conv-1",
      idempotencyKey: "idem-conv-1",
      messages: [{ role: "user", content: "FAKE_CLIENT_HISTORY" }],
      context: { tickets: [], fleet: [] },
      ...body
    }
  }, res);
  return res;
}

describe("AI assist durable conversation integration", () => {
  it("uses server-owned DB history instead of fake client messages when the pilot is on", async () => {
    const store = conversationStore({
      messages: [
        { role: "user", content: "stored first question", sequence: 1 },
        { role: "assistant", content: "stored first answer", sequence: 2 }
      ]
    });
    const providerCall = vi.fn(async ({ prompt }) => ({
      ok: true,
      provider: "google",
      model: "gemini-test",
      text: JSON.parse(prompt).recentConversation.map((message) => message.content).join(" | ")
    }));
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_CONVERSATIONS_PILOT: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "google",
        GOOGLE_GENERATIVE_AI_API_KEY: "test-key",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      conversationStore: store,
      memoryStore: { list: vi.fn(async () => []) },
      fleetDriver: { list: vi.fn(async () => []) },
      providerCall,
      now: () => 6000,
      rateBuckets: new Map()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    const prompt = JSON.parse(providerCall.mock.calls[0][0].prompt);
    expect(prompt.recentConversation.map((message) => message.content)).toEqual([
      "stored first question",
      "[previous assistant reply omitted; answer the current userRequest]",
      "continue from stored history"
    ]);
    expect(JSON.stringify(prompt)).not.toContain("FAKE_CLIENT_HISTORY");
    expect(store.appendMessage).toHaveBeenCalledWith(expect.objectContaining({
      role: "user",
      content: "continue from stored history",
      idempotencyKey: "idem-conv-1:user"
    }));
    expect(store.appendMessage).toHaveBeenCalledWith(expect.objectContaining({
      role: "assistant",
      content: expect.stringContaining("stored first question"),
      idempotencyKey: "idem-conv-1:assistant"
    }));
  });

  it("blocks foreign conversation IDs without calling the provider", async () => {
    const store = conversationStore({ ownerUserId: "u2" });
    const providerCall = vi.fn();
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_CONVERSATIONS_PILOT: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient({ id: "u1" }),
      conversationStore: store,
      providerCall,
      now: () => 7000,
      rateBuckets: new Map()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "conversation_not_found" });
    expect(providerCall).not.toHaveBeenCalled();
    expect(store.appendMessage).not.toHaveBeenCalled();
  });

  it("does not append a false assistant message when the provider fails", async () => {
    const store = conversationStore();
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_CONVERSATIONS_PILOT: "local",
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      conversationStore: store,
      memoryStore: { list: vi.fn(async () => []) },
      fleetDriver: { list: vi.fn(async () => []) },
      providerCall: vi.fn(async () => ({ ok: false, error: "provider down" })),
      now: () => 8000,
      rateBuckets: new Map()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(502);
    expect(store.savedMessages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(store.savedMessages.filter((message) => message.role === "assistant")).toHaveLength(0);
  });

  it("keeps legacy client-message behavior when the conversation pilot is off", async () => {
    const store = conversationStore();
    const providerCall = vi.fn(async ({ prompt }) => ({
      ok: true,
      provider: "openai",
      model: "gpt-test",
      text: JSON.stringify(JSON.parse(prompt).recentConversation)
    }));
    const handler = createAiAssistHandler({
      env: {
        CMMS_AI_MODE: "server",
        CMMS_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
        CMMS_AI_ASSIST_RATE_LIMIT_MS: "0"
      },
      sessionClient: sessionClient(),
      conversationStore: store,
      memoryStore: { list: vi.fn(async () => []) },
      fleetDriver: { list: vi.fn(async () => []) },
      providerCall,
      now: () => 9000,
      rateBuckets: new Map()
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(providerCall.mock.calls[0][0].prompt).recentConversation.map((message) => message.content)).toEqual(["FAKE_CLIENT_HISTORY"]);
    expect(store.appendMessage).not.toHaveBeenCalled();
  });
});
