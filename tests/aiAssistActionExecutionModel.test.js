import { describe, expect, it } from "vitest";
import { canExecuteAiAssistAction, prepareAiTaskCreateForSave, prepareAiTicketCommentForSave, prepareAiTicketCreateForSave, prepareAiTicketUpdateForSave, ticketPrefillFromAiAssistAction } from "../src/aiAssistActionExecutionModel.js";

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

const updateAction = {
  id: "update_ticket_priority",
  type: "ticket.update",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    ticketId: "ticket-1",
    patch: {
      priority: "high",
      status: "in_progress",
      description: "עודכן לאחר בדיקה",
      id: "evil-id"
    }
  },
  execute: { method: "POST", path: "/api/tickets", bodyField: "ticket" }
};

const waitingUpdateAction = {
  id: "update_ticket_waiting",
  type: "ticket.update",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    ticketId: "ticket-1",
    patch: {
      status: "waiting",
      waitingReason: "parts",
      waitBall: "executor"
    }
  },
  execute: { method: "POST", path: "/api/tickets", bodyField: "ticket" }
};

const commentAction = {
  id: "comment_ticket",
  type: "ticket.comment",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    ticketId: "ticket-1",
    note: "בדקתי מול הספק — ממתינים לתשובה"
  },
  execute: { method: "POST", path: "/api/tickets", bodyField: "ticket" }
};

const taskCreateAction = {
  id: "create_task",
  type: "task.create",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    title: "בדיקת הצעת מחיר",
    desc: "בדיקת הצעת מחיר למלגזה",
    status: "todo",
    priority: "medium",
    ownerId: "u1",
    responsibleIds: ["u1"],
    sourceModule: "ai_assist",
    createdAt: 1000,
    updatedAt: 1000,
    log: [{ at: 1000, by: "AI", byRole: "system", text: "draft", kind: "ai_draft" }],
    ai: { drafted: true, source: "ai_assist" }
  },
  execute: { method: "POST", path: "/api/work", resource: "tasks", bodyField: "task" }
};

const existingTicket = {
  id: "ticket-1",
  subject: "דליפת מים",
  priority: "medium",
  status: "new",
  description: "תיאור קודם",
  createdAt: 1000,
  updatedAt: 1500,
  log: [{ at: 1500, by: "Dana", byRole: "user", text: "נוצרה", kind: "created" }]
};

describe("AI assist action execution model", () => {
  it("allows only complete human-confirmed ticket.create actions through the normal tickets API contract", () => {
    expect(canExecuteAiAssistAction(readyAction)).toBe(true);
    expect(canExecuteAiAssistAction(updateAction)).toBe(true);
    expect(canExecuteAiAssistAction(commentAction)).toBe(true);
    expect(canExecuteAiAssistAction(taskCreateAction)).toBe(true);
    expect(canExecuteAiAssistAction({ ...readyAction, requiresConfirmation: false })).toBe(false);
    expect(canExecuteAiAssistAction({ ...readyAction, missingFields: ["zone"] })).toBe(false);
    expect(canExecuteAiAssistAction({ ...readyAction, execute: { method: "POST", path: "/api/kv" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...readyAction, payload: null })).toBe(false);
    expect(canExecuteAiAssistAction({ ...readyAction, type: "ticket.delete" })).toBe(false);
    expect(canExecuteAiAssistAction({ ...updateAction, payload: { ticketId: "ticket-1" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...commentAction, payload: { ticketId: "ticket-1", note: "" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...taskCreateAction, execute: { method: "POST", path: "/api/tickets", bodyField: "task" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...taskCreateAction, payload: { desc: "missing title" } })).toBe(false);
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

  it("prepares a confirmed AI task for the existing saveTask path", () => {
    const task = prepareAiTaskCreateForSave(taskCreateAction, { id: "u1", name: "Vadim", role: "admin" }, {
      now: 2000,
      makeId: () => "ai-task-1"
    });

    expect(task).toMatchObject({
      id: "ai-task-1",
      title: "בדיקת הצעת מחיר",
      desc: "בדיקת הצעת מחיר למלגזה",
      status: "todo",
      priority: "medium",
      sourceModule: "ai_assist",
      ownerId: "u1",
      responsibleIds: ["u1"],
      updatedAt: 2000,
      ai: {
        drafted: true,
        source: "ai_assist",
        confirmedByHuman: true,
        confirmedAt: 2000,
        actionId: "create_task"
      }
    });
    expect(task.log).toEqual([
      { at: 1000, by: "AI", byRole: "system", text: "draft", kind: "ai_draft" },
      {
        at: 2000,
        by: "Vadim",
        byRole: "admin",
        text: "משתמש אישר יצירת משימה שהוכנה על ידי AI",
        kind: "ai_confirmed_task"
      }
    ]);
  });

  it("refuses to prepare incomplete or unsupported actions", () => {
    expect(() => prepareAiTicketCreateForSave({ ...readyAction, missingFields: ["forkliftId"] })).toThrow("ai_action_not_executable");
    expect(() => prepareAiTicketCreateForSave({ ...readyAction, execute: { method: "DELETE", path: "/api/tickets" } })).toThrow("ai_action_not_executable");
  });

  it("prepares a confirmed AI ticket update with an allow-listed patch and audit log", () => {
    const { ticket, changes } = prepareAiTicketUpdateForSave(updateAction, existingTicket, { name: "Vadim", role: "admin" }, { now: 3000 });

    expect(ticket).toMatchObject({
      id: "ticket-1",
      priority: "high",
      status: "in_progress",
      description: "עודכן לאחר בדיקה",
      updatedAt: 3000,
      ai: {
        source: "ai_assist",
        lastConfirmedAction: "update_ticket_priority",
        lastConfirmedAt: 3000
      }
    });
    expect(ticket.id).toBe("ticket-1");
    expect(changes).toEqual([
      { field: "priority", before: "medium", after: "high" },
      { field: "status", before: "new", after: "in_progress" },
      { field: "description", before: "תיאור קודם", after: "עודכן לאחר בדיקה" }
    ]);
    expect(ticket.log.at(-1)).toEqual({
      at: 3000,
      by: "Vadim",
      byRole: "admin",
      text: "משתמש אישר עדכון קריאה שהוכן על ידי AI: priority, status, description",
      kind: "ai_confirmed_update"
    });
  });

  it("allows confirmed waiting updates to carry a reason and responsibility ball", () => {
    const { ticket, changes } = prepareAiTicketUpdateForSave(waitingUpdateAction, existingTicket, { name: "Vadim", role: "admin" }, { now: 3500 });

    expect(ticket).toMatchObject({
      id: "ticket-1",
      status: "waiting",
      waitingReason: "parts",
      waitBall: "executor",
      updatedAt: 3500
    });
    expect(changes).toEqual([
      { field: "status", before: "new", after: "waiting" },
      { field: "waitingReason", before: "", after: "parts" },
      { field: "waitBall", before: "", after: "executor" }
    ]);
  });

  it("refuses ticket updates without a real changed allow-listed field", () => {
    expect(() => prepareAiTicketUpdateForSave({ ...updateAction, missingFields: ["status"] }, existingTicket)).toThrow("ai_action_not_executable");
    expect(() => prepareAiTicketUpdateForSave({ ...updateAction, payload: { ticketId: "other", patch: { priority: "high" } } }, existingTicket)).toThrow("ai_action_ticket_mismatch");
    expect(() => prepareAiTicketUpdateForSave({ ...updateAction, payload: { ticketId: "ticket-1", patch: { id: "evil-id" } } }, existingTicket)).toThrow("ai_action_no_allowed_changes");
  });

  it("prepares a confirmed AI ticket comment as a ticket log entry", () => {
    const { ticket, note } = prepareAiTicketCommentForSave(commentAction, existingTicket, { name: "Vadim", role: "admin" }, { now: 4000 });

    expect(note).toBe("בדקתי מול הספק — ממתינים לתשובה");
    expect(ticket).toMatchObject({
      id: "ticket-1",
      updatedAt: 4000,
      ai: {
        source: "ai_assist",
        lastConfirmedAction: "comment_ticket",
        lastConfirmedAt: 4000
      }
    });
    expect(ticket.log.at(-1)).toEqual({
      at: 4000,
      by: "Vadim",
      byRole: "admin",
      text: "משתמש אישר הערה שהוכנה על ידי AI: בדקתי מול הספק — ממתינים לתשובה",
      kind: "ai_confirmed_comment"
    });
  });

  it("refuses ticket comments without a matching ticket or note", () => {
    expect(() => prepareAiTicketCommentForSave({ ...commentAction, missingFields: ["note"] }, existingTicket)).toThrow("ai_action_not_executable");
    expect(() => prepareAiTicketCommentForSave({ ...commentAction, payload: { ticketId: "other", note: "בדיקה" } }, existingTicket)).toThrow("ai_action_ticket_mismatch");
    expect(() => prepareAiTicketCommentForSave({ ...commentAction, payload: { ticketId: "ticket-1", note: "" } }, existingTicket)).toThrow("ai_action_not_executable");
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
