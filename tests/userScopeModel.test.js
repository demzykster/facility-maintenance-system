import { describe, expect, it } from "vitest";
import {
  canUseScopedWorkerWrite,
  normalizeScopedWorkerForActor,
  scopedUsersForActor
} from "../src/userScopeModel.js";

const manager = {
  id: "mgr-1",
  role: "user",
  dept: "הפצה",
  depts: ["הפצה"],
  shift: "night"
};

describe("user scope model", () => {
  it("filters manager worker search to own department and shift", () => {
    const users = [
      { id: "a", role: "worker", name: "A", dept: "הפצה", shift: "night" },
      { id: "b", role: "worker", name: "B", dept: "הפצה", shift: "morning" },
      { id: "c", role: "worker", name: "C", dept: "מחסן", shift: "night" },
      { id: "d", role: "tech", name: "D", dept: "הפצה", shift: "night" }
    ];

    expect(scopedUsersForActor(users, manager, { role: "worker" }).map((u) => u.id)).toEqual(["a"]);
  });

  it("normalizes scoped manager-created workers to an allowed department and shift", () => {
    const result = normalizeScopedWorkerForActor({
      id: "worker-1",
      role: "worker",
      name: "Worker",
      workerNo: "101",
      dept: "מחסן",
      depts: ["מחסן"],
      shift: "morning",
      perms: { users: "manage" }
    }, manager);

    expect(result).toMatchObject({
      ok: true,
      user: {
        role: "worker",
        dept: "הפצה",
        depts: ["הפצה"],
        shift: "night",
        perms: undefined
      }
    });
  });

  it("allows server scoped worker writes only inside manager department and shift", () => {
    expect(canUseScopedWorkerWrite(manager, { role: "worker", dept: "הפצה", depts: ["הפצה"], shift: "night" })).toBe(true);
    expect(canUseScopedWorkerWrite(manager, { role: "worker", dept: "הפצה", depts: ["הפצה"], shift: "morning" })).toBe(false);
    expect(canUseScopedWorkerWrite(manager, { role: "worker", dept: "מחסן", depts: ["מחסן"], shift: "night" })).toBe(false);
    expect(canUseScopedWorkerWrite(manager, { role: "tech", dept: "הפצה", shift: "night" })).toBe(false);
  });
});
