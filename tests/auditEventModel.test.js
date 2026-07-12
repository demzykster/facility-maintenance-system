import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_EVENTS_TABLE_CONTRACT,
  aiAssistAuditEvent,
  auditEventId,
  fileAuditEvent,
  normalizeAuditEvent,
  permissionAuditEvent,
  settingsAuditEvent,
  ticketStatusAuditEvent
} from "../src/auditEventModel.js";

describe("auditEventModel", () => {
  it("normalizes the minimum durable audit event", () => {
    expect(normalizeAuditEvent({
      at: 123,
      actorId: "u1",
      actorName: "Owner",
      actorRole: "admin",
      entityType: AUDIT_ENTITY_TYPES.ticket,
      entityId: "T-1",
      action: AUDIT_ACTIONS.update,
      summary: "Changed ticket"
    })).toEqual({
      id: "123:u1:ticket:T-1:update",
      at: 123,
      actorId: "u1",
      actorName: "Owner",
      actorRole: "admin",
      entityType: "ticket",
      entityId: "T-1",
      action: "update",
      summary: "Changed ticket",
      before: {},
      after: {},
      metadata: {}
    });
  });

  it("rejects unknown entity types and actions", () => {
    expect(() => normalizeAuditEvent({ entityType: "other", action: AUDIT_ACTIONS.update })).toThrow("audit_entity_type_invalid");
    expect(() => normalizeAuditEvent({ entityType: AUDIT_ENTITY_TYPES.ticket, action: "other" })).toThrow("audit_action_invalid");
  });

  it("accepts task and meeting entity types for workflow audit taxonomy", () => {
    expect(normalizeAuditEvent({ entityType: AUDIT_ENTITY_TYPES.task, entityId: "mtask-1", action: AUDIT_ACTIONS.update })).toMatchObject({ entityType: "task", entityId: "mtask-1" });
    expect(normalizeAuditEvent({ entityType: AUDIT_ENTITY_TYPES.meeting, entityId: "mmeet-1", action: AUDIT_ACTIONS.update })).toMatchObject({ entityType: "meeting", entityId: "mmeet-1" });
  });

  it("builds ticket status events for lifecycle trust", () => {
    expect(ticketStatusAuditEvent(
      { id: "T-7", track: "transport", num: 7, updatedAt: 200 },
      "new",
      "closed",
      { id: "tech-1", name: "Tech", role: "tech" }
    )).toMatchObject({
      at: 200,
      actorId: "tech-1",
      entityType: "ticket",
      entityId: "T-7",
      action: "status_change",
      before: { status: "new" },
      after: { status: "closed" },
      metadata: { track: "transport", num: 7 }
    });
  });

  it("builds permission and settings events", () => {
    expect(permissionAuditEvent(
      { id: "u2", name: "Manager", role: "user" },
      { tickets: "view" },
      { tickets: "manage" },
      { id: "admin", name: "Owner", role: "admin" },
      { at: 300 }
    )).toMatchObject({
      at: 300,
      actorId: "admin",
      entityType: "permission",
      entityId: "u2",
      action: "permission_change",
      before: { tickets: "view" },
      after: { tickets: "manage" },
      metadata: { targetName: "Manager", targetRole: "user" }
    });

    expect(settingsAuditEvent("sla.waiting", 20, 30, { id: "admin" }, { at: 400 })).toMatchObject({
      at: 400,
      actorId: "admin",
      entityType: "settings",
      entityId: "sla.waiting",
      action: "update",
      before: { value: 20 },
      after: { value: 30 }
    });
  });

  it("builds file audit events from the file metadata contract", () => {
    expect(fileAuditEvent({
      id: "file-1",
      path: "tickets/T-1/before.jpg",
      kind: "ticket_before_photo",
      ownerType: "ticket",
      ownerId: "T-1",
      contentType: "image/jpeg",
      bucket: "cmms-files",
      createdById: "u1",
      createdByName: "Owner",
      createdByRole: "admin",
      createdAt: 500
    })).toMatchObject({
      at: 500,
      actorId: "u1",
      entityType: "file",
      entityId: "file-1",
      action: "upload",
      after: {
        path: "tickets/T-1/before.jpg",
        kind: "ticket_before_photo",
        ownerType: "ticket",
        ownerId: "T-1"
      },
      metadata: { contentType: "image/jpeg", bucket: "cmms-files" }
    });
  });

  it("builds AI assist audit events without raw prompt or context text", () => {
    const event = aiAssistAuditEvent({
      draft: {
        source: "ui",
        language: "he",
        module: "transport",
        severity: "critical",
        action: "draft_ticket",
        rawText: "secret user prompt",
        allowedToWrite: false,
        writePolicy: "human_confirmation_required"
      },
      context: {
        profile: { role: "user", department: "הפצה", canSeeCompany: false, canSeeFinancials: false },
        tickets: [{ id: "t1", subject: "hidden subject" }],
        fleet: [{ id: "f1" }],
        pm: [],
        metrics: { openTickets: 1 }
      },
      provider: "anthropic",
      model: "claude-test",
      providerStatus: "ok",
      workflow: "risk_summary"
    }, { id: "u1", name: "Manager", role: "user" }, { at: 700 });

    expect(event).toMatchObject({
      at: 700,
      actorId: "u1",
      actorRole: "user",
      entityType: "system",
      entityId: "ai-assist",
      action: "ai_assist",
      after: {
        allowedToWrite: false,
        writePolicy: "human_confirmation_required"
      },
      metadata: {
        module: "transport",
        severity: "critical",
        provider: "anthropic",
        model: "claude-test",
        providerStatus: "ok",
        workflow: "risk_summary",
        contextCounts: { tickets: 1, fleet: 1, pm: 0, metrics: 1 }
      }
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("secret user prompt");
    expect(serialized).not.toContain("hidden subject");
  });

  it("documents the audit table fields in one contract", () => {
    expect(AUDIT_EVENTS_TABLE_CONTRACT).toEqual([
      "id",
      "at",
      "actor_id",
      "actor_name",
      "actor_role",
      "entity_type",
      "entity_id",
      "action",
      "summary",
      "before",
      "after",
      "metadata"
    ]);
    expect(auditEventId({ at: 1, actorId: "u 1", entityType: "ticket", entityId: "T 1", action: "update" })).toBe("1:u-1:ticket:T-1:update");
  });
});
