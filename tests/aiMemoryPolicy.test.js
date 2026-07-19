import { describe, expect, it } from "vitest";
import {
  actorHasAiMemoryPilotPermission,
  memoryScopeAllowedForRead,
  memoryScopeAllowedForWrite,
  visibleMemoryFactsForActor
} from "../server/agent/memory/memoryPolicy.js";

const fleet = [
  { id: "asset-a", department: "Ops", supplier: "LiftCo" },
  { id: "asset-b", department: "Finance", supplier: "LiftCo" },
  { id: "asset-c", department: "Ops", supplier: "Other" }
];

describe("AI memory policy", () => {
  it("treats pilot membership as an explicit user permission, not a role default", () => {
    expect(actorHasAiMemoryPilotPermission({ role: "admin", permissions: {} })).toBe(false);
    expect(actorHasAiMemoryPilotPermission({ role: "worker", permissions: { aiMemoryPilot: "request" } })).toBe(true);
    expect(actorHasAiMemoryPilotPermission({ role: "user", perms: { aiMemoryPilot: "none" } })).toBe(false);
  });

  it("keeps personal memory visible only to the owner", () => {
    const fact = { id: "m1", scopeType: "personal", scopeId: "u1", status: "active", summary: "prefers morning" };

    expect(memoryScopeAllowedForRead({ id: "u1", role: "worker" }, fact, { fleet })).toBe(true);
    expect(memoryScopeAllowedForRead({ id: "u2", role: "admin" }, fact, { fleet })).toBe(false);
    expect(memoryScopeAllowedForWrite({ id: "u2", role: "admin" }, fact, { fleet })).toBe(true);
  });

  it("uses department and asset scope from the authenticated actor, not names alone", () => {
    const user = { id: "u1", role: "user", departments: ["Ops"] };
    expect(memoryScopeAllowedForRead(user, { scopeType: "department", scopeId: "Ops" }, { fleet })).toBe(true);
    expect(memoryScopeAllowedForRead(user, { scopeType: "department", scopeId: "Finance" }, { fleet })).toBe(false);
    expect(memoryScopeAllowedForRead(user, { scopeType: "asset", scopeId: "asset-a" }, { fleet })).toBe(true);
    expect(memoryScopeAllowedForRead(user, { scopeType: "asset", scopeId: "asset-b", summary: "same visible name" }, { fleet })).toBe(false);
  });

  it("filters retrieved facts before response construction", () => {
    const worker = { id: "worker-a", role: "worker", departments: ["Ops"] };
    const facts = [
      { id: "own", scopeType: "personal", scopeId: "worker-a", status: "active", summary: "own fact" },
      { id: "other", scopeType: "personal", scopeId: "worker-b", status: "active", summary: "other fact" },
      { id: "inactive", scopeType: "personal", scopeId: "worker-a", status: "deactivated", summary: "old fact" },
      { id: "asset", scopeType: "asset", scopeId: "asset-a", status: "active", summary: "asset fact" }
    ];

    expect(visibleMemoryFactsForActor(worker, facts, { fleet }).map((fact) => fact.id)).toEqual(["own", "asset"]);
  });
});
