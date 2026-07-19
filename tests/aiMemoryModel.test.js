import { describe, expect, it } from "vitest";
import { normalizeAiMemoryFactInput } from "../src/aiMemoryModel.js";

describe("AI memory model", () => {
  it("uses server actor, ids, and timestamps instead of client-supplied system fields", () => {
    const fact = normalizeAiMemoryFactInput({
      id: "client-id",
      scopeType: "personal",
      scopeId: "attacker",
      summary: "Synthetic fact",
      createdBy: "attacker",
      updatedBy: "attacker",
      createdAt: 1,
      updatedAt: 2,
      deactivatedAt: 3,
      metadata: { secret: "do-not-store", tags: ["safe", "safe"] }
    }, { id: "actor-1", role: "worker" }, {
      now: () => 5000,
      makeId: () => "server-id"
    });

    expect(fact).toMatchObject({
      id: "server-id",
      scopeType: "personal",
      scopeId: "actor-1",
      createdBy: "actor-1",
      updatedBy: "actor-1",
      createdAt: 5000,
      updatedAt: 5000,
      deactivatedAt: null,
      metadata: { tags: ["safe", "safe"] }
    });
    expect(JSON.stringify(fact)).not.toContain("do-not-store");
  });
});
