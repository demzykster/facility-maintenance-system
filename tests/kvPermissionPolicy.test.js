import { describe, expect, it } from "vitest";
import {
  kvReadValueForSession,
  kvReadPermissionError,
  kvWritePermissionError,
  kvWritePermissionForKey,
  redactUserSecrets,
  sensitiveKvWriteAuditEvent,
  sessionHasKvReadPermission,
  sessionHasKvWritePermission,
  sessionCanReadUserSecrets,
  sessionPermissionLevel
} from "../server/kv/permissionPolicy.js";

describe("KV write permission policy", () => {
  it("maps sensitive record keys to the existing module permissions", () => {
    expect(kvWritePermissionForKey("user:manager-1")).toMatchObject({ module: "users", minLevel: "manage" });
    expect(kvWritePermissionForKey("config:v1")).toMatchObject({ module: "settings", minLevel: "manage" });
    expect(kvWritePermissionForKey("fleet:truck-1")).toMatchObject({ module: "settings", minLevel: "manage" });
    expect(kvWritePermissionForKey("ppeitem:helmet")).toMatchObject({ module: "ppe", minLevel: "manage" });
    expect(kvWritePermissionForKey("czone:north")).toMatchObject({ module: "settings", minLevel: "manage" });
    expect(kvWritePermissionForKey("location:warehouse-a")).toMatchObject({ module: "settings", minLevel: "manage" });
  });

  it("maps ordinary workflow records to explicit role or module rules", () => {
    expect(kvWritePermissionForKey("ticket:T-001")).toMatchObject({ roles: ["admin", "user", "tech", "worker"], auditSensitive: false });
    expect(kvWritePermissionForKey("ppereq:req-1")).toMatchObject({ module: "ppe", minLevel: "request", auditSensitive: false });
    expect(kvWritePermissionForKey("cround:round-1")).toMatchObject({ roles: ["admin", "user"], access: "cleaning:perform", auditSensitive: false });
    expect(kvWritePermissionForKey("ccomplaint:issue-1")).toMatchObject({ roles: ["admin", "user"], access: "cleaning:perform", auditSensitive: false });
    expect(kvWritePermissionForKey("presence:worker-1")).toMatchObject({ roles: ["admin", "tech"], auditSensitive: false });
    expect(kvWritePermissionForKey("mtask:task-1")).toMatchObject({ roles: ["admin", "user"], entityType: "task", auditSensitive: false });
    expect(kvWritePermissionForKey("mmeet:meeting-1")).toMatchObject({ roles: ["admin", "user"], entityType: "meeting", auditSensitive: false });
    expect(kvWritePermissionForKey("appIssue:issue-1")).toMatchObject({ roles: expect.arrayContaining(["worker", "cleaner"]), auditSensitive: false });
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

  it("requires settings management for unknown shared KV prefixes", () => {
    expect(kvWritePermissionForKey("experimental:record-1")).toMatchObject({ module: "settings", minLevel: "manage", unknown: true });
    expect(sessionHasKvWritePermission({ role: "user", permissions: { settings: "view" } }, "experimental:record-1")).toBe(false);
    expect(sessionHasKvWritePermission({ role: "user", permissions: { settings: "manage" } }, "experimental:record-1")).toBe(true);
    expect(kvWritePermissionError({ role: "worker" }, "experimental:record-1")).toBe("permission_required:settings:manage");
  });

  it("allows only expected roles or module levels to write workflow records", () => {
    expect(sessionHasKvWritePermission({ role: "worker" }, "ticket:T-001")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "cleaner" }, "ticket:T-001")).toBe(false);
    expect(kvWritePermissionError({ role: "cleaner" }, "ticket:T-001")).toBe("permission_required:role:admin|user|tech|worker");

    expect(sessionHasKvWritePermission({ role: "user", permissions: { ppe: "request" } }, "ppereq:req-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "worker" }, "ppereq:req-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "tech", permissions: { ppe: "view" } }, "ppereq:req-1")).toBe(false);

    expect(sessionHasKvWritePermission({ role: "cleaner" }, "cround:round-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "worker", cleaningAccess: true }, "cround:round-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "worker" }, "cround:round-1")).toBe(false);
    expect(sessionHasKvWritePermission({ role: "worker", cleaningAccess: { enabled: true, canPerformRounds: true, canCloseComplaints: false } }, "ccomplaint:issue-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "worker", cleaningAccess: { enabled: true, canPerformRounds: false, canCloseComplaints: true } }, "ccomplaint:issue-1")).toBe(false);
    expect(sessionHasKvWritePermission({ role: "tech" }, "ccomplaint:issue-1")).toBe(false);
    expect(kvWritePermissionError({ role: "tech" }, "ccomplaint:issue-1")).toBe("permission_required:cleaning:perform");
    expect(sessionHasKvWritePermission({ id: "tech-1", role: "tech" }, "presence:tech-1")).toBe(true);
    expect(sessionHasKvWritePermission({ id: "worker-1", role: "worker" }, "presence:worker-1")).toBe(true);
    expect(sessionHasKvWritePermission({ id: "manager-1", role: "user" }, "presence:manager-1")).toBe(true);
    expect(sessionHasKvWritePermission({ id: "worker-2", role: "worker" }, "presence:worker-1")).toBe(false);
    expect(kvWritePermissionError({ id: "worker-2", role: "worker" }, "presence:worker-1")).toBe("permission_required:presence:self");
    expect(sessionHasKvWritePermission({ role: "user" }, "mtask:task-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "worker" }, "mtask:task-1")).toBe(false);
    expect(sessionHasKvWritePermission({ role: "cleaner" }, "appIssue:issue-1")).toBe(true);
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

  it("limits sensitive KV reads to the owning user or matching module permission", () => {
    expect(sessionHasKvReadPermission({ role: "admin" }, "user:worker-1")).toBe(true);
    expect(sessionHasKvReadPermission({ id: "worker-1", role: "worker" }, "user:worker-1")).toBe(true);
    expect(sessionHasKvReadPermission({ id: "worker-2", role: "worker" }, "user:worker-1")).toBe(false);
    expect(sessionHasKvReadPermission({ role: "user", permissions: { users: "view" } }, "user:worker-1")).toBe(true);
    expect(kvReadPermissionError({ id: "worker-2", role: "worker" }, "user:worker-1")).toBe("permission_required:users:view");

    expect(sessionHasKvReadPermission({ role: "admin" }, "appIssue:issue-1")).toBe(true);
    expect(sessionHasKvReadPermission({ role: "user", permissions: { settings: "manage" } }, "appIssue:issue-1")).toBe(true);
    expect(sessionHasKvReadPermission({ role: "worker" }, "appIssue:issue-1")).toBe(false);
    expect(kvReadPermissionError({ role: "worker" }, "appIssue:issue-1")).toBe("permission_required:settings:manage");
  });

  it("builds audit events for sensitive writes without auditing ordinary workflow writes", () => {
    expect(sensitiveKvWriteAuditEvent({ key: "ticket:T-001" })).toBeNull();
    expect(sensitiveKvWriteAuditEvent({ key: "ppereq:req-1" })).toBeNull();
    expect(sensitiveKvWriteAuditEvent({ key: "ccomplaint:issue-1" })).toBeNull();

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

    expect(sensitiveKvWriteAuditEvent({ key: "experimental:record-1", method: "PUT" })).toMatchObject({
      entityType: "settings",
      entityId: "experimental:record-1",
      action: "update",
      metadata: { requiredPermission: "settings:manage" }
    });
  });
});
