import { describe, expect, it } from "vitest";
import {
  AI_MEMORY_PILOT_PERMISSION,
  aiMemoryAccessStatus,
  aiMemoryEffectiveAccess,
  normalizeAiMemoryFactInput
} from "../src/aiMemoryModel.js";

describe("AI memory model", () => {
  it("requires both the global flag and explicit pilot permission", () => {
    const pilot = { id: "u1", role: "user", permissions: { [AI_MEMORY_PILOT_PERMISSION]: "request" } };
    const notPilot = { id: "u2", role: "admin", permissions: {} };

    expect(aiMemoryEffectiveAccess({ CMMS_AI_MEMORY_PILOT: "true" }, pilot)).toBe(true);
    expect(aiMemoryEffectiveAccess({}, pilot)).toBe(false);
    expect(aiMemoryEffectiveAccess({ CMMS_AI_MEMORY_PILOT: "true" }, notPilot)).toBe(false);
    expect(aiMemoryAccessStatus({ CMMS_AI_MEMORY_PILOT: "true" }, pilot)).toEqual({
      globalEnabled: true,
      pilotMember: true,
      effectiveAccess: true
    });
  });

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
