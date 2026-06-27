import { describe, expect, it } from "vitest";
import {
  kvWritePermissionError,
  kvWritePermissionForKey,
  sessionHasKvWritePermission,
  sessionPermissionLevel
} from "../api/kv/permissionPolicy.js";

describe("KV write permission policy", () => {
  it("maps sensitive record keys to the existing module permissions", () => {
    expect(kvWritePermissionForKey("user:manager-1")).toMatchObject({ module: "users", minLevel: "manage" });
    expect(kvWritePermissionForKey("config:v1")).toMatchObject({ module: "settings", minLevel: "manage" });
    expect(kvWritePermissionForKey("fleet:truck-1")).toMatchObject({ module: "settings", minLevel: "manage" });
    expect(kvWritePermissionForKey("ppeitem:helmet")).toMatchObject({ module: "ppe", minLevel: "manage" });
    expect(kvWritePermissionForKey("czone:north")).toMatchObject({ module: "settings", minLevel: "manage" });
  });

  it("leaves ordinary workflow records open to the current authenticated writer bridge", () => {
    expect(kvWritePermissionForKey("ticket:T-001")).toBeNull();
    expect(kvWritePermissionForKey("ppereq:req-1")).toBeNull();
    expect(kvWritePermissionForKey("cround:round-1")).toBeNull();
    expect(kvWritePermissionForKey("ccomplaint:issue-1")).toBeNull();
  });

  it("uses admin role and stored permissions from production sessions", () => {
    expect(sessionHasKvWritePermission({ role: "admin" }, "user:worker-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "user", permissions: { users: "manage" } }, "user:worker-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "user", permissions: { users: "view" } }, "user:worker-1")).toBe(false);
    expect(sessionHasKvWritePermission({ role: "user", perms: { settings: "manage" } }, "config:v1")).toBe(true);
  });

  it("returns stable permission error codes for blocked writes", () => {
    expect(sessionPermissionLevel({ role: "user", permissions: { ppe: "request" } }, "ppe")).toBe("request");
    expect(kvWritePermissionError({ role: "user", permissions: { ppe: "request" } }, "ppeorder:po-1")).toBe("permission_required:ppe:manage");
    expect(kvWritePermissionError({ role: "user", permissions: { ppe: "manage" } }, "ppeorder:po-1")).toBeNull();
  });
});
