import { describe, expect, it } from "vitest";
import { findUserDuplicateGroups, userIdentityKey } from "../src/userDuplicateModel.js";

describe("user duplicate model", () => {
  it("builds login identity keys by role", () => {
    expect(userIdentityKey({ role: "admin", email: "Vadim@Example.COM" })).toBe("email:vadim@example.com");
    expect(userIdentityKey({ role: "worker", workerNo: "1042" })).toBe("worker:1042");
    expect(userIdentityKey({ role: "cleaner", workerNo: "1050" })).toBe("worker:1050");
    expect(userIdentityKey({ role: "tech", pin: "1234" })).toBe("tech:1234");
  });

  it("finds active duplicate login identities and ignores archived users", () => {
    const groups = findUserDuplicateGroups([
      { id: "a1", role: "admin", email: "same@example.com" },
      { id: "a2", role: "user", email: "SAME@example.com" },
      { id: "w1", role: "worker", workerNo: "1042" },
      { id: "w2", role: "worker", workerNo: "1042", status: "archived" },
      { id: "t1", role: "tech", pin: "2222" }
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].map((u) => u.id)).toEqual(["a1", "a2"]);
  });
});
