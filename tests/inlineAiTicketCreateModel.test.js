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
  inlineAiTicketPlaceholder,
  inlineAiTicketPrimaryActionLabel,
  inlineAiTicketRecentMessages,
  inlineTicketIntakeStateFromActions,
  inlineAiTicketVisibleActions
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
      workflow: AI_ASSIST_WORKFLOWS.ticketIntake,
      includeProviderPlan: true,
      idempotencyKey: "idem-inline",
      context: {
        intent: "create_ticket",
        uiSurface: "inline_ticket_create",
        taskSession: { type: "ticket_intake", transient: true },
        currentEntityHintOnly: true
      }
    });
    expect(request).not.toHaveProperty("conversationId");
    expect(request.context.currentEntity).toEqual({ id: "asset-123" });
  });

  it("carries server-derived pending facility intake state into the next transient request", () => {
    const firstState = {
      ...createInlineAiTicketInitialState(),
      msgs: [
        { role: "assistant", content: "תארו בקצרה מה קרה. אפשר לציין מספר כלי, אזור או ציוד." },
        { role: "user", content: "מזגן לא עובד בחדר מפעיל מערכת" }
      ]
    };
    const completed = completeInlineAiTicketSend(firstState, {
      text: "באיזה אזור או מחלקה נמצאת התקלה?",
      actions: [{
        id: "create_ticket",
        type: "ticket.create",
        status: "needs_human_input",
        missingFields: ["zone"],
        payload: {
          track: "facility",
          subject: "מזגן לא עובד בחדר מפעיל מערכת",
          category: "hvac",
          priority: "medium",
          zone: "",
          description: "דווח כי המזגן בחדר מפעיל המערכת אינו עובד. יש לבדוק את התקלה."
        }
      }]
    });

    expect(completed.intake).toMatchObject({
      domain: "facility",
      pendingField: "location",
      draft: {
        track: "facility",
        subject: "מזגן לא עובד בחדר מפעיל מערכת",
        category: "hvac",
        priority: "medium"
      }
    });
    expect(inlineAiTicketPlaceholder(completed)).toBe("לדוגמה: משרדי הפצה");

    const request = buildInlineAiTicketRequest({
      text: "משרדי הפצה",
      messages: completed.msgs,
      context: {},
      intake: completed.intake,
      idempotencyKey: "idem-facility-followup"
    });

    expect(request.context.taskSession).toMatchObject({
      type: "ticket_intake",
      transient: true,
      intake: {
        domain: "facility",
        pendingField: "location",
        draft: {
          track: "facility",
          subject: "מזגן לא עובד בחדר מפעיל מערכת",
          category: "hvac",
          priority: "medium"
        }
      }
    });
  });

  it("uses context-aware placeholders and resets intake after a completed ticket", () => {
    expect(inlineAiTicketPlaceholder(createInlineAiTicketInitialState())).toBe("תארו בקצרה את התקלה");
    expect(inlineAiTicketPlaceholder({
      intake: inlineTicketIntakeStateFromActions([{
        type: "ticket.create",
        missingFields: ["forkliftId"],
        payload: { track: "transport", subject: "גלגל שבור" }
      }])
    })).toBe("לדוגמה: מלגזה 210");

    const completed = completeInlineAiTicketSend({
      ...createInlineAiTicketInitialState(),
      intake: { domain: "facility", pendingField: "location", draft: { track: "facility" }, status: "pending" }
    }, {
      capabilityResponse: {
        executionStatus: "created",
        actionResult: { ticketId: "ticket-1", ticketNumber: "T-001" }
      }
    });

    expect(completed.intake).toBeNull();
  });

  it("marks plain inline problem descriptions as ticket-intake instead of general chat", () => {
    const request = buildInlineAiTicketRequest({
      text: "המזגן במחסן לא עובד",
      context: {},
      idempotencyKey: "idem-facility"
    });

    expect(request).toMatchObject({
      workflow: AI_ASSIST_WORKFLOWS.ticketIntake,
      context: {
        intent: "create_ticket",
        taskSession: { type: "ticket_intake", transient: true }
      }
    });
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

  it("does not render blocked missing-field actions as technical inline cards", () => {
    const actions = inlineAiTicketVisibleActions([
      { id: "facility-missing-zone", type: "ticket.create", status: "needs_human_input", missingFields: ["zone"], payload: { track: "facility" } },
      { id: "facility-ready", type: "ticket.create", status: "ready_for_confirmation", missingFields: [], payload: { track: "facility" } }
    ]);

    expect(actions.map((action) => action.id)).toEqual(["facility-ready"]);
    expect(JSON.stringify(actions)).not.toContain("zone");
  });

  it("uses one clear form-review action label instead of duplicate completion buttons", () => {
    const formAction = {
      type: "ticket.create",
      status: "needs_form_review",
      reviewMode: "ticket_form",
      missingFields: ["downtimeType"],
      payload: { track: "transport" }
    };

    expect(inlineAiTicketActionMode(formAction)).toBe("form");
    expect(inlineAiTicketPrimaryActionLabel(formAction)).toBe("המשך לטופס הקריאה");
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
