import { describe, expect, it } from "vitest";
import { AI_ASSIST_WORKFLOWS } from "../src/aiAssistWorkflowModel.js";
import {
  beginInlineAiTicketSend,
  buildInlineAiTicketRequest,
  completeInlineAiTicketSend,
  createInlineAiTicketInitialState,
  inlineAiTicketActionMode,
  inlineAiTicketEffectiveAccess,
  inlineAiTicketFromCapabilityResponse,
  inlineAiTicketRecentMessages
} from "../src/inlineAiTicketCreateModel.js";

describe("inline AI ticket create model", () => {
  it("shows the intake only for active management users when AI is effectively enabled", () => {
    expect(inlineAiTicketEffectiveAccess({ aiEnabled: true, session: { role: "admin" } })).toBe(true);
    expect(inlineAiTicketEffectiveAccess({ aiEnabled: true, session: { role: "executive" } })).toBe(true);
    expect(inlineAiTicketEffectiveAccess({ aiEnabled: true, session: { role: "user" } })).toBe(true);
    expect(inlineAiTicketEffectiveAccess({ aiEnabled: false, session: { role: "user" } })).toBe(false);
    expect(inlineAiTicketEffectiveAccess({ aiEnabled: true, session: { role: "user", active: false } })).toBe(false);
    expect(inlineAiTicketEffectiveAccess({ aiEnabled: true, session: { role: "worker" } })).toBe(false);
    expect(inlineAiTicketEffectiveAccess({ aiEnabled: true, session: { role: "tech" } })).toBe(false);
  });

  it("does not build an outgoing request before non-empty user send", () => {
    const state = createInlineAiTicketInitialState();

    expect(beginInlineAiTicketSend(state, { text: "", context: {} }).request).toBeNull();
    expect(beginInlineAiTicketSend({ ...state, busy: true, input: "בדיקה" }, { context: {} }).request).toBeNull();
    expect(beginInlineAiTicketSend({ ...state, createdTicket: { id: "T-1" }, input: "עוד" }, { context: {} }).request).toBeNull();
  });

  it("uses the existing AI assist contract as a transient ticket-intake request", () => {
    const request = buildInlineAiTicketRequest({
      text: "במלגזה 123 לא עובד הצופר",
      messages: [{ role: "assistant", content: "שלום" }],
      context: { fleet: [{ id: "asset-123", code: "123" }], currentEntity: { id: "asset-123" } },
      idempotencyKey: "idem-inline"
    });

    expect(request).toMatchObject({
      text: "במלגזה 123 לא עובד הצופר",
      workflow: AI_ASSIST_WORKFLOWS.draftPreparation,
      includeProviderPlan: true,
      idempotencyKey: "idem-inline",
      context: {
        uiSurface: "inline_ticket_create",
        taskSession: { type: "ticket_intake", transient: true },
        currentEntityHintOnly: true
      }
    });
    expect(request).not.toHaveProperty("conversationId");
    expect(request.context.currentEntity).toEqual({ id: "asset-123" });
  });

  it("keeps only transient recent messages and never needs durable conversations", () => {
    const messages = inlineAiTicketRecentMessages([
      { role: "assistant", content: "welcome" },
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "system", content: "hidden" },
      { role: "user", content: "c" }
    ]);

    expect(messages).toEqual([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" }
    ]);
  });

  it("classifies ticket actions for confirm, form fallback, and missing-field clarification", () => {
    expect(inlineAiTicketActionMode({ type: "ticket.create", status: "ready_for_confirmation" })).toBe("confirm");
    expect(inlineAiTicketActionMode({ type: "ticket.create", status: "needs_form_review" })).toBe("form");
    expect(inlineAiTicketActionMode({ type: "ticket.create", missingFields: ["forkliftId"] })).toBe("needs_input");
    expect(inlineAiTicketActionMode({ type: "ticket.update" })).toBe("ignore");
  });

  it("normalizes server-created autonomous ticket results for the compact success card", () => {
    expect(inlineAiTicketFromCapabilityResponse({
      draft: { subject: "צופר", description: "בדיקה" },
      capabilityResponse: {
        executionStatus: "created",
        actionResult: { ticketId: "ticket-1", ticketNumber: "T-007", num: 7, forkliftId: "asset-123" }
      }
    })).toEqual({
      id: "ticket-1",
      track: "transport",
      ticketNo: "T-007",
      num: 7,
      subject: "צופר",
      description: "בדיקה",
      asset: "asset-123",
      source: "server"
    });
  });

  it("marks the session as created once a server result is returned so retry cannot create a second ticket", () => {
    const state = {
      ...createInlineAiTicketInitialState(),
      msgs: [{ role: "assistant", content: "שלום" }, { role: "user", content: "פתח קריאה" }]
    };
    const completed = completeInlineAiTicketSend(state, {
      text: "נוצרה קריאה.",
      capabilityResponse: {
        executionStatus: "created",
        actionResult: { ticketId: "ticket-1", ticketNumber: "T-001" }
      }
    });

    expect(completed.createdTicket).toMatchObject({ id: "ticket-1", ticketNo: "T-001" });
    expect(beginInlineAiTicketSend({ ...completed, input: "שלח שוב" }, { context: {} }).request).toBeNull();
  });
});
