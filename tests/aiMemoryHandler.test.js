import { describe, expect, it, vi } from "vitest";
import { createAiMemoryHandler } from "../server/agent/memory/memoryHandler.js";

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

async function call(handler, req = {}) {
  const res = createRes();
  await handler({
    method: "GET",
    headers: { authorization: "Bearer token" },
    body: {},
    query: {},
    ...req
  }, res);
  return res;
}

function memoryStore(rows = []) {
  const data = rows.map((row) => ({ ...row }));
  return {
    list: vi.fn(async () => data),
    get: vi.fn(async (id) => data.find((row) => row.id === id) || null),
    create: vi.fn(async (fact) => {
      data.unshift({ ...fact });
      return fact;
    }),
    update: vi.fn(async (id, patch) => {
      const index = data.findIndex((row) => row.id === id);
      data[index] = { ...data[index], ...patch };
      return data[index];
    })
  };
}

const fleetDriver = {
  list: vi.fn(async () => [
    { id: "asset-a", department: "Ops" },
    { id: "asset-b", department: "Finance" }
  ])
};

describe("AI memory handler", () => {
  it("requires auth and the memory pilot flag", async () => {
    const handler = createAiMemoryHandler({ sessionClient: sessionClient(), memoryStore: memoryStore() });

    expect((await call(handler, { headers: {} })).statusCode).toBe(401);
    expect((await call(handler)).json()).toEqual({ error: "ai_memory_pilot_disabled" });
  });

  it("lists only scoped active facts and writes retrieval audit without raw request body", async () => {
    const auditDriver = { write: vi.fn(async () => {}) };
    const store = memoryStore([
      { id: "own", scopeType: "personal", scopeId: "u1", status: "active", summary: "Own fact", sourceLabel: "AI chat" },
      { id: "other", scopeType: "personal", scopeId: "u2", status: "active", summary: "Other fact" },
      { id: "asset", scopeType: "asset", scopeId: "asset-a", status: "active", summary: "Asset fact" },
      { id: "inactive", scopeType: "personal", scopeId: "u1", status: "deactivated", summary: "Old fact" }
    ]);
    const handler = createAiMemoryHandler({
      env: { CMMS_AI_MEMORY_PILOT: "local" },
      sessionClient: sessionClient(),
      memoryStore: store,
      fleetDriver,
      auditDriver,
      now: () => 1000
    });

    const res = await call(handler, { headers: { authorization: "Bearer token", "x-request-id": "req-memory" } });

    expect(res.statusCode).toBe(200);
    expect(res.json().facts.map((fact) => fact.id)).toEqual(["own", "asset"]);
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "memory",
      action: "use",
      metadata: expect.objectContaining({ requestId: "req-memory", usedFactIds: ["own", "asset"] })
    }));
    expect(JSON.stringify(auditDriver.write.mock.calls[0][0])).not.toContain("Bearer");
  });

  it("creates, updates, and deactivates memory only inside write scope", async () => {
    const auditDriver = { write: vi.fn(async () => {}) };
    const store = memoryStore([]);
    const handler = createAiMemoryHandler({
      env: { CMMS_AI_MEMORY_PILOT: "local" },
      sessionClient: sessionClient({ id: "worker-a", role: "worker", departments: ["Ops"] }),
      memoryStore: store,
      fleetDriver,
      auditDriver,
      now: () => 2000
    });

    const blocked = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token", "x-request-id": "req-blocked-memory" },
      body: { fact: { scopeType: "department", scopeId: "Ops", summary: "Shared fact" } }
    });
    expect(blocked.statusCode).toBe(403);
    expect(store.create).not.toHaveBeenCalled();
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "memory",
      action: "create",
      metadata: expect.objectContaining({
        outcome: "blocked",
        reason: "memory_scope_forbidden",
        requestId: "req-blocked-memory"
      })
    }));
    expect(JSON.stringify(auditDriver.write.mock.calls[0][0])).not.toContain("Shared fact");

    const created = await call(handler, {
      method: "POST",
      body: { fact: { scopeType: "personal", summary: "Personal fact", sourceLabel: "AI chat confirmation", metadata: { secret: "do-not-store" } } }
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().action).toBe("created");
    expect(created.json().fact).toMatchObject({ scopeType: "personal", scopeId: "worker-a", summary: "Personal fact" });
    expect(store.create.mock.calls[0][0].metadata).toEqual({ tags: [] });

    const replayed = await call(handler, {
      method: "POST",
      body: { fact: { scopeType: "personal", summary: "Personal fact", sourceLabel: "AI chat confirmation" } }
    });
    expect(replayed.statusCode).toBe(200);
    expect(replayed.json()).toMatchObject({ action: "replayed", fact: { id: created.json().fact.id } });
    expect(store.create).toHaveBeenCalledTimes(1);

    const factId = created.json().fact.id;
    const updated = await call(handler, {
      method: "PATCH",
      body: { id: factId, fact: { summary: "Updated personal fact" } }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      action: "updated",
      supersededFactId: factId,
      fact: {
        summary: "Updated personal fact",
        version: 2,
        supersedesId: factId
      }
    });
    await expect(store.get(factId)).resolves.toMatchObject({ status: "superseded" });

    const deactivated = await call(handler, {
      method: "DELETE",
      body: { id: updated.json().fact.id, reason: "forget" }
    });
    expect(deactivated.statusCode).toBe(200);
    expect(deactivated.json().fact.status).toBe("deactivated");
  });

  it("does not disclose out-of-scope memory through direct ID requests", async () => {
    const store = memoryStore([
      { id: "own", scopeType: "personal", scopeId: "worker-a", status: "active", summary: "Own fact" },
      { id: "other", scopeType: "personal", scopeId: "worker-b", status: "active", summary: "Other fact" }
    ]);
    const handler = createAiMemoryHandler({
      env: { CMMS_AI_MEMORY_PILOT: "local" },
      sessionClient: sessionClient({ id: "worker-a", role: "worker", departments: ["Ops"] }),
      memoryStore: store,
      fleetDriver
    });

    expect((await call(handler, { query: { id: "own" } })).json()).toMatchObject({ fact: { id: "own" } });
    const hidden = await call(handler, { query: { id: "other" } });
    expect(hidden.statusCode).toBe(404);
    expect(hidden.json()).toEqual({ error: "memory_fact_not_found" });
  });
});
