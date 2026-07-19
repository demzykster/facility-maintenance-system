import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTIONS, aiConversationAuditEvent } from "../src/auditEventModel.js";
import { createAiConversationHandler } from "../server/agent/conversations/conversationHandler.js";

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
      role: "worker",
      name: "Worker A",
      ...profile
    })
  };
}

const pilotPermissions = { aiConversationsPilot: "request" };

function conversationStore(seed = []) {
  const conversations = [...seed];
  const messages = new Map();
  return {
    conversations,
    messages,
    listMine: vi.fn(async ({ ownerUserId }) => conversations.filter((item) => item.ownerUserId === ownerUserId && item.status === "active")),
    getMine: vi.fn(async ({ id, ownerUserId }) => conversations.find((item) => item.id === id && item.ownerUserId === ownerUserId) || null),
    listMessages: vi.fn(async ({ conversationId }) => messages.get(conversationId) || []),
    create: vi.fn(async (conversation) => {
      conversations.push(conversation);
      return conversation;
    }),
    archiveMine: vi.fn(async ({ id, ownerUserId, at }) => {
      const item = conversations.find((conversation) => conversation.id === id && conversation.ownerUserId === ownerUserId);
      if (!item) return null;
      Object.assign(item, { status: "archived", updatedAt: at });
      return item;
    })
  };
}

async function call(handler, { method = "GET", query = {}, body = {}, headers = { authorization: "Bearer token" } } = {}) {
  const res = createRes();
  await handler({ method, headers, query, body }, res);
  return res;
}

describe("AI conversation handler", () => {
  it("creates distinct audit IDs for multiple message append events in one request", () => {
    const actor = { id: "u1", role: "worker", name: "Worker A" };
    const conversation = { id: "conv-1", status: "active" };
    const userEvent = aiConversationAuditEvent({
      conversation,
      action: AUDIT_ACTIONS.update,
      outcome: "created",
      requestId: "req-1",
      messageRole: "user"
    }, actor, { at: 1000 });
    const assistantEvent = aiConversationAuditEvent({
      conversation,
      action: AUDIT_ACTIONS.update,
      outcome: "created",
      requestId: "req-1",
      messageRole: "assistant"
    }, actor, { at: 1000 });

    expect(userEvent.id).not.toBe(assistantEvent.id);
    expect(JSON.stringify(userEvent)).not.toContain("secret");
  });

  it("requires auth and the conversation pilot flag", async () => {
    const handler = createAiConversationHandler({ sessionClient: sessionClient(), conversationStore: conversationStore() });

    expect((await call(handler, { headers: {} })).statusCode).toBe(401);
    const disabled = await call(handler);
    expect(disabled.statusCode).toBe(404);
    expect(disabled.json()).toEqual({ error: "ai_conversations_pilot_disabled" });
  });

  it("requires explicit conversation pilot permission even for manager roles", async () => {
    const auditDriver = { write: vi.fn(async () => {}) };
    const store = conversationStore();
    const handler = createAiConversationHandler({
      env: { CMMS_AI_CONVERSATIONS_PILOT: "local" },
      sessionClient: sessionClient({ role: "executive", permissions: {} }),
      conversationStore: store,
      auditDriver,
      now: () => 1500
    });

    const res = await call(handler, { method: "POST", body: { title: "Should block", permissions: { aiConversationsPilot: "request" } } });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "ai_conversations_pilot_permission_required" });
    expect(store.create).not.toHaveBeenCalled();
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      action: "create",
      metadata: expect.objectContaining({
        outcome: "blocked",
        reason: "conversation_pilot_permission_required"
      })
    }));
    expect(JSON.stringify(auditDriver.write.mock.calls)).not.toContain("Should block");
  });

  it("does not grant access to worker or tech roles without explicit pilot permission", async () => {
    for (const role of ["worker", "tech"]) {
      const store = conversationStore();
      const handler = createAiConversationHandler({
        env: { CMMS_AI_CONVERSATIONS_PILOT: "local" },
        sessionClient: sessionClient({ role, permissions: {} }),
        conversationStore: store
      });

      const res = await call(handler);

      expect(res.statusCode).toBe(403);
      expect(store.listMine).not.toHaveBeenCalled();
    }
  });

  it("keeps inactive users out even when they carry the pilot permission", async () => {
    const store = conversationStore();
    const handler = createAiConversationHandler({
      env: { CMMS_AI_CONVERSATIONS_PILOT: "local" },
      sessionClient: sessionClient({ active: false, permissions: pilotPermissions }),
      conversationStore: store
    });

    const res = await call(handler);

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "app_user_disabled" });
    expect(store.listMine).not.toHaveBeenCalled();
  });

  it("creates conversations only for the authenticated owner and returns safe DTOs", async () => {
    const store = conversationStore();
    const handler = createAiConversationHandler({
      env: { CMMS_AI_CONVERSATIONS_PILOT: "local" },
      sessionClient: sessionClient({ permissions: pilotPermissions }),
      conversationStore: store,
      now: () => 1000
    });

    const res = await call(handler, {
      method: "POST",
      body: { title: "Server-owned", ownerUserId: "attacker", metadata: { secret: "NOPE" } }
    });

    expect(res.statusCode).toBe(201);
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: "u1",
      title: "Server-owned"
    }));
    expect(res.json().conversation.ownerUserId).toBeUndefined();
    expect(JSON.stringify(res.json())).not.toContain("NOPE");
  });

  it("replays idempotent conversation creation without creating a duplicate", async () => {
    const auditDriver = { write: vi.fn(async () => {}) };
    const store = conversationStore();
    const handler = createAiConversationHandler({
      env: { CMMS_AI_CONVERSATIONS_PILOT: "local" },
      sessionClient: sessionClient({ permissions: pilotPermissions }),
      conversationStore: store,
      auditDriver,
      now: () => 2000
    });

    const first = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token", "idempotency-key": "conv-create-1" },
      body: { title: "Replay-safe", ownerUserId: "attacker" }
    });
    const second = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token", "idempotency-key": "conv-create-1" },
      body: { title: "Replay-safe", ownerUserId: "attacker" }
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(first.json().conversation.id).toBe(second.json().conversation.id);
    expect(store.conversations).toHaveLength(1);
    expect(store.conversations[0]).toMatchObject({
      ownerUserId: "u1",
      title: "Replay-safe"
    });
    expect(JSON.stringify(second.json())).not.toContain("ownerUserId");
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      action: "create",
      metadata: expect.objectContaining({ outcome: "replayed" })
    }));
  });

  it("does not disclose another user's conversation through list or direct ID", async () => {
    const store = conversationStore([
      { id: "own", ownerUserId: "u1", title: "Own", status: "active" },
      { id: "foreign", ownerUserId: "u2", title: "Foreign", status: "active" }
    ]);
    const handler = createAiConversationHandler({
      env: { CMMS_AI_CONVERSATIONS_PILOT: "local" },
      sessionClient: sessionClient({ permissions: pilotPermissions }),
      conversationStore: store
    });

    const list = await call(handler);
    expect(list.statusCode).toBe(200);
    expect(list.json().conversations.map((conversation) => conversation.id)).toEqual(["own"]);

    const direct = await call(handler, { query: { id: "foreign" } });
    expect(direct.statusCode).toBe(404);
    expect(direct.json()).toEqual({ error: "conversation_not_found" });
  });

  it("archives only owned conversations and writes safe audit metadata", async () => {
    const auditDriver = { write: vi.fn(async () => {}) };
    const store = conversationStore([{ id: "own", ownerUserId: "u1", title: "Own", status: "active" }]);
    const handler = createAiConversationHandler({
      env: { CMMS_AI_CONVERSATIONS_PILOT: "local" },
      sessionClient: sessionClient({ permissions: pilotPermissions }),
      conversationStore: store,
      auditDriver,
      now: () => 3000
    });

    const res = await call(handler, { method: "DELETE", body: { id: "own", reason: "user_requested secret=NOPE" } });

    expect(res.statusCode).toBe(200);
    expect(res.json().conversation).toMatchObject({ id: "own", status: "archived" });
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "system",
      entityId: "ai-conversation",
      action: "deactivate",
      metadata: expect.objectContaining({ conversationId: "own", outcome: "ok" })
    }));
    expect(JSON.stringify(auditDriver.write.mock.calls)).not.toContain("NOPE");
  });
});
