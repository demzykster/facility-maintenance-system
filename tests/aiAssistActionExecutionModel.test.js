import { describe, expect, it } from "vitest";
import { canExecuteAiAssistAction, prepareAiTicketCreateForSave, ticketPrefillFromAiAssistAction } from "../src/aiAssistActionExecutionModel.js";

const readyAction = {
  id: "create_ticket",
  type: "ticket.create",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    track: "facility",
    subject: "דליפת מים",
    description: "יש דליפה באזור קבלה",
    zone: "קבלה",
    status: "new",
    createdAt: 1000,
    log: [{ at: 1000, by: "AI", byRole: "system", text: "draft", kind: "ai_draft" }],
    ai: { drafted: true, source: "ai_assist" }
  },
  execute: { method: "POST", path: "/api/tickets", bodyField: "ticket" }
};

describe("AI assist action execution model", () => {
  it("allows only complete human-confirmed ticket.create actions through the normal tickets API contract", () => {
    expect(canExecuteAiAssistAction(readyAction)).toBe(true);
    expect(canExecuteAiAssistAction({ ...readyAction, requiresConfirmation: false })).toBe(false);
    expect(canExecuteAiAssistAction({ ...readyAction, missingFields: ["zone"] })).toBe(false);
    expect(canExecuteAiAssistAction({ ...readyAction, execute: { method: "POST", path: "/api/kv" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...readyAction, type: "ticket.delete" })).toBe(false);
  });

  it("prepares a confirmed AI ticket for the existing saveTicket path", () => {
    const ticket = prepareAiTicketCreateForSave(readyAction, { name: "Vadim", role: "admin" }, {
      now: 2000,
      makeId: () => "ai-ticket-1"
    });

    expect(ticket).toMatchObject({
      id: "ai-ticket-1",
      subject: "דליפת מים",
      updatedAt: 2000,
      ai: {
        drafted: true,
        source: "ai_assist",
        confirmedByHuman: true,
        confirmedAt: 2000,
        actionId: "create_ticket"
      }
    });
    expect(ticket.log).toEqual([
      { at: 1000, by: "AI", byRole: "system", text: "draft", kind: "ai_draft" },
      {
        at: 2000,
        by: "Vadim",
        byRole: "admin",
        text: "משתמש אישר יצירת קריאה שהוכנה על ידי AI",
        kind: "ai_confirmed"
      }
    ]);
  });

  it("refuses to prepare incomplete or unsupported actions", () => {
    expect(() => prepareAiTicketCreateForSave({ ...readyAction, missingFields: ["forkliftId"] })).toThrow("ai_action_not_executable");
    expect(() => prepareAiTicketCreateForSave({ ...readyAction, execute: { method: "DELETE", path: "/api/tickets" } })).toThrow("ai_action_not_executable");
  });

  it("builds a normal TicketForm prefill from incomplete ticket proposals", () => {
    const prefill = ticketPrefillFromAiAssistAction({
      ...readyAction,
      missingFields: ["forkliftId", "downtimeType"],
      payload: {
        track: "transport",
        subject: "רעש בהרמה",
        description: "המלגזה מרעישה בזמן הרמה",
        priority: "high",
        forkliftId: "fork-1",
        downtimeType: "critical",
        incidentShift: "night",
        driverInvolved: "אבי",
        driverInvolvedId: "11032"
      }
    });

    expect(prefill).toMatchObject({
      track: "transport",
      subject: "רעש בהרמה",
      description: "המלגזה מרעישה בזמן הרמה",
      priority: "high",
      forkliftId: "fork-1",
      downtimeType: "critical",
      incidentShift: "night",
      driverInvolved: "אבי",
      driverInvolvedId: "11032"
    });
    expect(ticketPrefillFromAiAssistAction({ ...readyAction, type: "ticket.delete" })).toBeNull();
  });
});
