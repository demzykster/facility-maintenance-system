import { describe, expect, it } from "vitest";
import {
  AI_CONVERSATION_STATUSES,
  aiConversationForClient,
  aiConversationMessageForClient,
  aiConversationsPilotEnabled,
  buildAiConversationRecentHistory,
  normalizeAiConversationInput,
  normalizeAiConversationMessageInput,
  normalizeAiConversationRow
} from "../src/aiConversationModel.js";

describe("AI conversation model", () => {
  const actor = { id: "u1", role: "worker", name: "Worker A" };

  it("keeps the conversation pilot behind its own flag", () => {
    expect(aiConversationsPilotEnabled({})).toBe(false);
    expect(aiConversationsPilotEnabled({ CMMS_AI_CONVERSATIONS_PILOT: "true" })).toBe(true);
    expect(aiConversationsPilotEnabled({ CMMS_AI_MEMORY_PILOT: "true" })).toBe(false);
  });

  it("normalizes conversations with server-owned personal ownership", () => {
    const conversation = normalizeAiConversationInput({
      ownerUserId: "attacker",
      title: "  A very useful maintenance conversation  "
    }, actor, { now: () => 1000, makeId: () => "conv-1" });

    expect(conversation).toMatchObject({
      id: "conv-1",
      ownerUserId: "u1",
      title: "A very useful maintenance conversation",
      status: AI_CONVERSATION_STATUSES.active,
      createdAt: 1000,
      updatedAt: 1000,
      lastMessageAt: 1000
    });
  });

  it("normalizes messages and strips unsafe client metadata", () => {
    const message = normalizeAiConversationMessageInput({
      id: "client-id",
      role: "system",
      content: "  hello\n\nworld  ",
      requestId: "req-1",
      idempotencyKey: "idem-1",
      metadata: { provider: "google", secret: "SHOULD_NOT_KEEP", token: "NOPE" }
    }, {
      conversationId: "conv-1",
      role: "user",
      actor
    }, { now: () => 2000, makeId: () => "msg-1" });

    expect(message).toEqual({
      id: "msg-1",
      conversationId: "conv-1",
      role: "user",
      content: "hello\n\nworld",
      requestId: "req-1",
      idempotencyKey: "idem-1",
      sequence: 0,
      createdAt: 2000,
      metadata: { provider: "google" }
    });
  });

  it("returns safe DTOs without owner-only internals or secrets", () => {
    const dto = aiConversationForClient(normalizeAiConversationRow({
      id: "conv-1",
      owner_user_id: "u1",
      title: "Ops",
      status: "active",
      metadata: { secret: "NOPE", lastProvider: "google" }
    }));
    const message = aiConversationMessageForClient({
      id: "msg-1",
      conversationId: "conv-1",
      role: "assistant",
      content: "Answer",
      metadata: { provider: "google", token: "NOPE" }
    });

    expect(dto).toMatchObject({ id: "conv-1", title: "Ops", status: "active" });
    expect(dto.ownerUserId).toBeUndefined();
    expect(JSON.stringify(dto)).not.toContain("NOPE");
    expect(message).toMatchObject({ id: "msg-1", role: "assistant", content: "Answer" });
    expect(message.conversationId).toBeUndefined();
    expect(JSON.stringify(message)).not.toContain("NOPE");
  });

  it("builds stable recent history from stored messages only", () => {
    const history = buildAiConversationRecentHistory([
      { role: "assistant", content: "welcome", sequence: 1 },
      { role: "user", content: "first", sequence: 2 },
      { role: "assistant", content: "reply", sequence: 3 },
      { role: "user", content: "latest", sequence: 4 }
    ], { limit: 3 });

    expect(history).toEqual([
      { role: "user", content: "first" },
      { role: "assistant", content: "reply" },
      { role: "user", content: "latest" }
    ]);
  });
});
