import { describe, expect, it, vi } from "vitest";
import {
  buildAiAssistApiPayload,
  callAiAssistApi,
  createAiAssistIdempotencyKey,
  createAiMemoryFact,
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
