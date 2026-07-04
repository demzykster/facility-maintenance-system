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
    expect(kvWritePermissionForKey("ccomplaint:issue-1")).toMatchObject({ roles: ["admin", "user"], access: "cleaning:closeComplaint", auditSensitive: false });
    expect(kvWritePermissionForKey("controlProgram:program-1")).toMatchObject({ module: "controls", minLevel: "manage", auditSensitive: false });
    expect(kvWritePermissionForKey("controlAssignment:assignment-1")).toMatchObject({ module: "controls", minLevel: "manage", auditSensitive: false });
    expect(kvWritePermissionForKey("controlRun:run-1")).toMatchObject({ module: "controls", minLevel: "request", auditSensitive: false });
    expect(kvWritePermissionForKey("controlFinding:finding-1")).toMatchObject({ module: "controls", minLevel: "request", auditSensitive: false });
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
    expect(sessionHasKvWritePermission({ role: "worker", cleaningAccess: { enabled: true, canCloseComplaints: false } }, "ccomplaint:issue-1")).toBe(false);
    expect(sessionHasKvWritePermission({ role: "worker", cleaningAccess: { enabled: true, canCloseComplaints: true } }, "ccomplaint:issue-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "tech" }, "ccomplaint:issue-1")).toBe(false);
    expect(kvWritePermissionError({ role: "tech" }, "ccomplaint:issue-1")).toBe("permission_required:cleaning:closeComplaint");
    expect(sessionHasKvWritePermission({ role: "tech" }, "presence:tech-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "worker" }, "presence:worker-1")).toBe(false);
    expect(sessionHasKvWritePermission({ role: "user" }, "mtask:task-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "worker" }, "mtask:task-1")).toBe(false);
    expect(sessionHasKvWritePermission({ role: "user", permissions: { controls: "request" } }, "controlRun:run-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "user", permissions: { controls: "request" } }, "controlProgram:program-1")).toBe(false);
    expect(sessionHasKvWritePermission({ role: "user", permissions: { controls: "request" } }, "controlAssignment:assignment-1")).toBe(false);
    expect(sessionHasKvWritePermission({ role: "user", permissions: { controls: "manage" } }, "controlProgram:program-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "user", permissions: { controls: "manage" } }, "controlAssignment:assignment-1")).toBe(true);
    expect(sessionHasKvWritePermission({ role: "user", permissions: { controls: "view" } }, "controlFinding:finding-1")).toBe(false);
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
