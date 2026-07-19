import { describe, expect, it, vi } from "vitest";
import {
  buildAiAssistApiPayload,
  archiveAiConversation,
  callAiAssistApi,
  createAiConversation,
  createAiAssistIdempotencyKey,
  createAiMemoryFact,
  getAiConversation,
  getAiConversationAccess,
  listAiConversations,
  listAiMemoryFacts
} from "../src/aiAgentApiClient.js";
import { AI_ASSIST_WORKFLOWS } from "../src/aiAssistWorkflowModel.js";

describe("AI agent API client", () => {
  it("keeps the /api/ai/assist request payload contract", () => {
    expect(buildAiAssistApiPayload({
      text: "בדיקה",
      messages: [{ role: "user", content: "בדיקה" }],
      context: { currentEntity: { id: "asset-1" } },
      workflow: AI_ASSIST_WORKFLOWS.riskSummary,
      includeProviderPlan: true,
      idempotencyKey: "idem-1"
    })).toEqual({
      text: "בדיקה",
      messages: [{ role: "user", content: "בדיקה" }],
      language: "he",
      source: "ui",
      workflow: AI_ASSIST_WORKFLOWS.riskSummary,
      includeProviderPlan: true,
      idempotencyKey: "idem-1",
      context: { currentEntity: { id: "asset-1" } }
    });
  });

  it("generates stable UUID idempotency identities when available", () => {
    expect(createAiAssistIdempotencyKey({
      cryptoRef: { randomUUID: () => "uuid-1" }
    })).toBe("uuid-1");
  });

  it("calls the server endpoint with auth and returns normalized assistant data", async () => {
    const fetchImpl = vi.fn(async (_url, options) => ({
      ok: true,
      json: async () => ({
        assistant: { text: "תשובה" },
        actions: [{ id: "a1" }],
        memoryCitations: [{ id: "mem-1", summary: "עובדה שמורה" }],
        memoryGrounding: { usedMemoryIds: ["mem-1"] },
        providerPlan: { summary: "תוכנית" },
        providerPlanErrorCode: ""
      }),
      options
    }));

    const result = await callAiAssistApi({
      text: "בדיקה",
      messages: [{ role: "user", content: "בדיקה" }],
      context: { tickets: [] },
      workflow: AI_ASSIST_WORKFLOWS.general,
      includeProviderPlan: false,
      idempotencyKey: "idem-2",
      getAccessToken: async () => "access-token",
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledWith("/api/ai/assist", expect.objectContaining({
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-token"
      }
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      idempotencyKey: "idem-2",
      source: "ui",
      language: "he"
    });
    expect(result).toEqual({
      text: "תשובה",
      actions: [{ id: "a1" }],
      memoryCitations: [{ id: "mem-1", summary: "עובדה שמורה" }],
      memoryGrounding: { usedMemoryIds: ["mem-1"] },
      providerPlan: { summary: "תוכנית" },
      providerPlanErrorCode: ""
    });
  });

  it("passes conversationId through assist only when provided", () => {
    expect(buildAiAssistApiPayload({
      text: "בדיקה",
      messages: [],
      conversationId: "conv-1",
      idempotencyKey: "idem-3"
    })).toMatchObject({
      text: "בדיקה",
      conversationId: "conv-1",
      idempotencyKey: "idem-3"
    });
  });

  it("uses the provider-neutral conversations API with auth", async () => {
    const calls = [];
    const fetchImpl = vi.fn(async (url, options) => {
      calls.push({ url, options });
      if (options.method === "GET" && url === "/api/ai/conversations") {
        return { ok: true, json: async () => ({ conversations: [{ id: "conv-1", title: "Ops" }] }) };
      }
      if (options.method === "POST") {
        return { ok: true, json: async () => ({ conversation: { id: "conv-2", title: "New" } }) };
      }
      if (options.method === "GET" && String(url).includes("id=conv-1")) {
        return { ok: true, json: async () => ({ conversation: { id: "conv-1" }, messages: [{ id: "msg-1", role: "user", content: "Hi" }] }) };
      }
      return { ok: true, json: async () => ({ conversation: { id: "conv-1", status: "archived" } }) };
    });
    const getAccessToken = async () => "access-token";

    await expect(listAiConversations({ getAccessToken, fetchImpl })).resolves.toEqual([{ id: "conv-1", title: "Ops" }]);
    await expect(createAiConversation({ title: "New", getAccessToken, fetchImpl })).resolves.toEqual({ id: "conv-2", title: "New" });
    await expect(getAiConversation({ id: "conv-1", getAccessToken, fetchImpl })).resolves.toEqual({
      conversation: { id: "conv-1" },
      messages: [{ id: "msg-1", role: "user", content: "Hi" }]
    });
    await expect(archiveAiConversation({ id: "conv-1", getAccessToken, fetchImpl })).resolves.toEqual({ id: "conv-1", status: "archived" });
    expect(calls.every((call) => call.options.headers.authorization === "Bearer access-token")).toBe(true);
    expect(calls.map((call) => call.options.method)).toEqual(["GET", "POST", "GET", "DELETE"]);
  });

  it("reads effective conversation access from the authenticated AI status endpoint", async () => {
    const access = await getAiConversationAccess({
      getAccessToken: async () => "access-token",
      fetchImpl: vi.fn(async (url, options) => ({
        ok: true,
        json: async () => ({
          ai: {
            conversations: {
              globalEnabled: true,
              pilotMember: true,
              effectiveAccess: true
            }
          }
        }),
        url,
        options
      }))
    });

    expect(access).toEqual({
      globalEnabled: true,
      pilotMember: true,
      effectiveAccess: true
    });
  });

  it("treats disabled or unauthorized conversations as unavailable UI controls", async () => {
    const permissionDenied = await listAiConversations({
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: "ai_conversations_pilot_permission_required" })
      })
    });
    const disabledCreate = await createAiConversation({
      title: "No access",
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: "ai_conversations_pilot_permission_required" })
      })
    });

    expect(permissionDenied).toEqual([]);
    expect(disabledCreate).toBeNull();
  });

  it("preserves server error codes for the panel error mapper", async () => {
    await expect(callAiAssistApi({
      text: "בדיקה",
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: "access_token_required" })
      })
    })).rejects.toThrow("access_token_required");
  });

  it("keeps deterministic action cards from non-2xx assist responses", async () => {
    const result = await callAiAssistApi({
      text: "Запомни: synthetic fact",
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        json: async () => ({
          error: "ai_server_disabled",
          draft: { userReply: "Provider unavailable" },
          actions: [{ id: "create_memory_fact", type: "memory.fact.create" }]
        })
      })
    });

    expect(result).toEqual({
      text: "Provider unavailable",
      actions: [{ id: "create_memory_fact", type: "memory.fact.create" }],
      memoryCitations: [],
      memoryGrounding: null,
      providerPlan: null,
      providerPlanErrorCode: "ai_server_disabled"
    });
  });

  it("creates confirmed memory facts through /api/ai/memory with auth", async () => {
    const fetchImpl = vi.fn(async (_url, _options) => ({
      ok: true,
      json: async () => ({ fact: { id: "mem-1", summary: "Morning maintenance", scopeType: "personal" } })
    }));

    const fact = await createAiMemoryFact({
      fact: { summary: "Morning maintenance" },
      getAccessToken: async () => "access-token",
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledWith("/api/ai/memory", expect.objectContaining({
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-token"
      }
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      fact: { summary: "Morning maintenance" }
    });
    expect(fact).toEqual({ id: "mem-1", summary: "Morning maintenance", scopeType: "personal" });
  });

  it("treats disabled or unauthenticated memory pilot reads as empty memory", async () => {
    const disabled = await listAiMemoryFacts({
      fetchImpl: async () => ({
        ok: false,
        status: 404,
        json: async () => ({ error: "ai_memory_pilot_disabled" })
      })
    });
    const unauth = await listAiMemoryFacts({
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: "access_token_required" })
      })
    });

    expect(disabled).toEqual([]);
    expect(unauth).toEqual([]);
  });
});
