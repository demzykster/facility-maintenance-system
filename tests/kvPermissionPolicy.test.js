import { describe, expect, it } from "vitest";
import {
  kvReadValueForSession,
  kvWritePermissionError,
  kvWritePermissionForKey,
  redactUserSecrets,
  sensitiveKvWriteAuditEvent,
  sessionHasKvWritePermission,
  sessionCanReadUserSecrets,
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

  it("redacts user login secrets for sessions that cannot manage users or worker access", () => {
    expect(sessionCanReadUserSecrets({ role: "admin" })).toBe(true);
    expect(sessionCanReadUserSecrets({ role: "user", permissions: { users: "manage" } })).toBe(true);
    expect(sessionCanReadUserSecrets({ role: "user", permissions: { workerAccess: "manage" } })).toBe(true);
    expect(sessionCanReadUserSecrets({ role: "user", permissions: { users: "view" } })).toBe(false);

    const record = {
      id: "worker-1",
      name: "Worker",
      workerNo: "1042",
      password: "secret",
      pin: "1234",
      activationToken: "token",
      activationStatus: "pending"
    };

    expect(redactUserSecrets(record)).toEqual({
      id: "worker-1",
      name: "Worker",
      workerNo: "1042",
      activationStatus: "pending"
    });
    expect(JSON.parse(kvReadValueForSession({
      key: "user:worker-1",
      value: JSON.stringify(record),
      session: { role: "user", permissions: { users: "view" } }
    }))).toEqual({
      id: "worker-1",
      name: "Worker",
      workerNo: "1042",
      activationStatus: "pending"
    });
    expect(kvReadValueForSession({
      key: "user:worker-1",
      value: JSON.stringify(record),
      session: { role: "admin" }
    })).toBe(JSON.stringify(record));
  });

  it("builds audit events for sensitive writes without changing ordinary workflow writes", () => {
    expect(sensitiveKvWriteAuditEvent({ key: "ticket:T-001" })).toBeNull();

    expect(sensitiveKvWriteAuditEvent({
      key: "config:v1",
      method: "PUT",
      actor: { id: "u-1", name: "Owner", role: "admin" },
      before: "{\"old\":true}",
      after: "{\"new\":true}",
      shared: true,
      at: 1000
    })).toMatchObject({
      at: 1000,
      actorId: "u-1",
      entityType: "settings",
      entityId: "config:v1",
      action: "update",
      before: { value: "{\"old\":true}" },
      after: { value: "{\"new\":true}" },
      metadata: { key: "config:v1", shared: true, requiredPermission: "settings:manage" }
    });

    expect(sensitiveKvWriteAuditEvent({ key: "ppeorder:po-1", method: "DELETE" })).toMatchObject({
      entityType: "ppe",
      entityId: "ppeorder:po-1",
      action: "delete",
      metadata: { requiredPermission: "ppe:manage" }
    });
  });
});
