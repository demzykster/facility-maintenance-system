import { describe, expect, it } from "vitest";
import { canExecuteAiAssistAction, prepareAiCleaningComplaintCreateForSave, prepareAiMeetingCreateForSave, prepareAiMeetingUpdateForSave, prepareAiPpeRequestCreateForSave, prepareAiTaskCreateForSave, prepareAiTaskUpdateForSave, prepareAiTicketCommentForSave, prepareAiTicketCreateForSave, prepareAiTicketUpdateForSave, ticketPrefillFromAiAssistAction } from "../src/aiAssistActionExecutionModel.js";

const readyAction = {
  id: "create_ticket",
  type: "ticket.create",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    track: "facility",
    subject: "דליפת מים",
    description: "יש דליפה באזור קבלה",
    priority: "medium",
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

const zoneUpdateAction = {
  id: "update_ticket_zone",
  type: "ticket.update",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    ticketId: "ticket-1",
    patch: {
      zone: "משרדים",
      log: [{ text: "evil" }]
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

const meetingCreateAction = {
  id: "create_meeting",
  type: "meeting.create",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    title: "פגישת תקלות בטיחות",
    type: "boss",
    purpose: "לעבור על תקלות בטיחות פתוחות",
    at: 86402000,
    status: "planned",
    ownerId: "u1",
    participantIds: ["u1"],
    createdAt: 1000,
    updatedAt: 1000,
    log: [{ at: 1000, by: "AI", byRole: "system", text: "draft", kind: "ai_draft" }],
    ai: { drafted: true, source: "ai_assist" }
  },
  execute: { method: "POST", path: "/api/work", resource: "meetings", bodyField: "meeting" }
};

const meetingUpdateAction = {
  id: "update_meeting_time",
  type: "meeting.update",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    meetingId: "meeting-1",
    patch: {
      at: 86402000,
      id: "evil-id"
    }
  },
  execute: { method: "POST", path: "/api/work", resource: "meetings", bodyField: "meeting" }
};

const ppeRequestCreateAction = {
  id: "create_ppe_request_vest",
  type: "ppe.request.create",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    workerId: "u1",
    workerName: "Vadim",
    workerNo: "11032",
    dept: "הפצה",
    lines: [
      { itemId: "vest", itemName: "אפוד זוהר", category: "hivis", size: "אחיד", qty: 1 }
    ],
    note: "אני צריך אפוד זוהר"
  },
  execute: { method: "POST", path: "/api/ppe", resource: "requests", bodyField: "request" }
};

const cleaningComplaintCreateAction = {
  id: "create_cleaning_complaint_zone-kitchen",
  type: "cleaning.complaint.create",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    zoneId: "zone-kitchen",
    zoneName: "מטבחון",
    zoneLoc: "בניין A",
    kind: "dirty",
    text: "הרצפה מלוכלכת",
    reportedById: "u1",
    reportedByName: "Vadim",
    reportedByRole: "admin",
    noPhotoReason: "דווח דרך עוזר AI ללא תמונה מצורפת"
  },
  execute: { method: "POST", path: "/api/cleaning/records", resource: "complaints", bodyField: "complaint" }
};

const taskUpdateAction = {
  id: "update_task_priority",
  type: "task.update",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    taskId: "task-1",
    patch: {
      priority: "high",
      status: "in_progress",
      id: "evil-id"
    }
  },
  execute: { method: "POST", path: "/api/work", resource: "tasks", bodyField: "task" }
};

const taskDueUpdateAction = {
  id: "update_task_due",
  type: "task.update",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    taskId: "task-1",
    patch: {
      dueAt: 86402000
    }
  },
  execute: { method: "POST", path: "/api/work", resource: "tasks", bodyField: "task" }
};

const taskResponsibleUpdateAction = {
  id: "update_task_responsible",
  type: "task.update",
  requiresConfirmation: true,
  missingFields: [],
  payload: {
    taskId: "task-1",
    patch: {
      responsibleIds: ["u2"],
      participantIds: ["evil"]
    }
  },
  execute: { method: "POST", path: "/api/work", resource: "tasks", bodyField: "task" }
};

const existingTicket = {
  id: "ticket-1",
  subject: "דליפת מים",
  priority: "medium",
  status: "new",
  description: "תיאור קודם",
  zone: "קבלה",
  createdAt: 1000,
  updatedAt: 1500,
  log: [{ at: 1500, by: "Dana", byRole: "user", text: "נוצרה", kind: "created" }]
};

const existingTask = {
  id: "task-1",
  title: "בדיקת ספק",
  priority: "medium",
  status: "todo",
  createdAt: 1000,
  updatedAt: 1500,
  log: [{ at: 1500, by: "Dana", byRole: "user", text: "נוצרה", kind: "created" }]
};

const existingMeeting = {
  id: "meeting-1",
  title: "ישיבת בטיחות",
  at: 36002000,
  status: "planned",
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
    expect(canExecuteAiAssistAction(meetingCreateAction)).toBe(true);
    expect(canExecuteAiAssistAction(meetingUpdateAction)).toBe(true);
    expect(canExecuteAiAssistAction(taskUpdateAction)).toBe(true);
    expect(canExecuteAiAssistAction(ppeRequestCreateAction)).toBe(true);
    expect(canExecuteAiAssistAction(cleaningComplaintCreateAction)).toBe(true);
    expect(canExecuteAiAssistAction({ ...readyAction, requiresConfirmation: false })).toBe(false);
    expect(canExecuteAiAssistAction({ ...readyAction, missingFields: ["zone"] })).toBe(false);
    expect(canExecuteAiAssistAction({ ...readyAction, execute: { method: "POST", path: "/api/kv" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...readyAction, payload: null })).toBe(false);
    expect(canExecuteAiAssistAction({ ...readyAction, type: "ticket.delete" })).toBe(false);
    expect(canExecuteAiAssistAction({ ...updateAction, payload: { ticketId: "ticket-1" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...commentAction, payload: { ticketId: "ticket-1", note: "" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...taskCreateAction, execute: { method: "POST", path: "/api/tickets", bodyField: "task" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...taskCreateAction, payload: { desc: "missing title" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...meetingCreateAction, execute: { method: "POST", path: "/api/work", resource: "tasks", bodyField: "meeting" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...meetingCreateAction, payload: { purpose: "missing title" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...meetingUpdateAction, payload: { meetingId: "meeting-1" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...meetingUpdateAction, execute: { method: "POST", path: "/api/tickets", bodyField: "meeting" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...taskUpdateAction, payload: { taskId: "task-1" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...taskUpdateAction, execute: { method: "POST", path: "/api/tickets", bodyField: "task" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...ppeRequestCreateAction, missingFields: ["size"] })).toBe(false);
    expect(canExecuteAiAssistAction({ ...ppeRequestCreateAction, payload: { ...ppeRequestCreateAction.payload, lines: [{ itemId: "vest", itemName: "אפוד זוהר", qty: 1 }] } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...ppeRequestCreateAction, execute: { method: "POST", path: "/api/tickets", bodyField: "request" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...cleaningComplaintCreateAction, missingFields: ["zoneId"] })).toBe(false);
    expect(canExecuteAiAssistAction({ ...cleaningComplaintCreateAction, payload: { ...cleaningComplaintCreateAction.payload, zoneId: "" } })).toBe(false);
    expect(canExecuteAiAssistAction({ ...cleaningComplaintCreateAction, execute: { method: "POST", path: "/api/tickets", bodyField: "complaint" } })).toBe(false);
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

  it("prepares a confirmed AI meeting for the existing saveMeeting path", () => {
    const meeting = prepareAiMeetingCreateForSave(meetingCreateAction, { id: "u1", name: "Vadim", role: "admin" }, {
      now: 2000,
      makeId: () => "ai-meeting-1"
    });

    expect(meeting).toMatchObject({
      id: "ai-meeting-1",
      title: "פגישת תקלות בטיחות",
      type: "boss",
      purpose: "לעבור על תקלות בטיחות פתוחות",
      at: 86402000,
      status: "planned",
      ownerId: "u1",
      participantIds: ["u1"],
      updatedAt: 2000,
      ai: {
        drafted: true,
        source: "ai_assist",
        confirmedByHuman: true,
        confirmedAt: 2000,
        actionId: "create_meeting"
      }
    });
    expect(meeting.log).toEqual([
      { at: 1000, by: "AI", byRole: "system", text: "draft", kind: "ai_draft" },
      {
        at: 2000,
        by: "Vadim",
        byRole: "admin",
        text: "משתמש אישר יצירת פגישה שהוכנה על ידי AI",
        kind: "ai_confirmed_meeting"
      }
    ]);
  });

  it("prepares a confirmed AI PPE request for the existing savePpeReq path", () => {
    const request = prepareAiPpeRequestCreateForSave(ppeRequestCreateAction, { id: "u1", name: "Vadim", role: "admin" }, {
      now: 2000,
      makeId: () => "ai-ppe-1"
    });

    expect(request).toEqual({
      id: "ai-ppe-1",
      status: "pending",
      awaitWorkerSign: false,
      workerId: "u1",
      workerName: "Vadim",
      workerNo: "11032",
      dept: "הפצה",
      lines: [{
        itemId: "vest",
        itemName: "אפוד זוהר",
        category: "hivis",
        size: "אחיד",
        qty: 1,
        workerCharge: 0,
        chargeReason: "",
        clawbackEligible: false,
        unitCost: 0,
        retPrev: false,
        returnRequested: false
      }],
      note: "אני צריך אפוד זוהר",
      signature: "",
      by: { id: "u1", name: "Vadim" },
      at: 2000,
      ai: {
        drafted: true,
        source: "ai_assist",
        confirmedByHuman: true,
        confirmedAt: 2000,
        actionId: "create_ppe_request_vest"
      },
      log: [{
        at: 2000,
        by: "Vadim",
        byRole: "admin",
        text: "משתמש אישר בקשת ביגוד שהוכנה על ידי AI",
        kind: "ai_confirmed_ppe_request"
      }]
    });
  });

  it("prepares a confirmed AI cleaning complaint for the existing fileComplaint path", () => {
    const complaint = prepareAiCleaningComplaintCreateForSave(cleaningComplaintCreateAction, { id: "u1", name: "Vadim", role: "admin" }, {
      now: 4000,
      makeId: () => "complaint-ai-1"
    });

    expect(complaint).toMatchObject({
      id: "complaint-ai-1",
      zoneId: "zone-kitchen",
      zoneName: "מטבחון",
      zoneLoc: "בניין A",
      kind: "dirty",
      text: "הרצפה מלוכלכת",
      photo: null,
      noPhotoReason: "דווח דרך עוזר AI ללא תמונה מצורפת",
      reportedById: "u1",
      reportedByName: "Vadim",
      reportedByRole: "admin",
      ai: {
        drafted: true,
        source: "ai_assist",
        confirmedByHuman: true,
        confirmedAt: 4000,
        actionId: "create_cleaning_complaint_zone-kitchen"
      }
    });
    expect(complaint.log).toEqual([
      expect.objectContaining({
        at: 4000,
        by: "Vadim",
        byRole: "admin",
        text: "משתמש אישר דיווח ניקיון שהוכן על ידי AI",
        kind: "ai_confirmed_cleaning_complaint"
      })
    ]);
  });

  it("prepares a confirmed AI meeting update with an allow-listed patch and audit log", () => {
    const { meeting, changes } = prepareAiMeetingUpdateForSave(meetingUpdateAction, existingMeeting, { name: "Vadim", role: "admin" }, { now: 3000 });

    expect(meeting).toMatchObject({
      id: "meeting-1",
      title: "ישיבת בטיחות",
      at: 86402000,
      status: "planned",
      updatedAt: 3000,
      ai: {
        source: "ai_assist",
        lastConfirmedAction: "update_meeting_time",
        lastConfirmedAt: 3000
      }
    });
    expect(meeting.id).toBe("meeting-1");
    expect(changes).toEqual([
      { field: "at", before: 36002000, after: 86402000 }
    ]);
    expect(meeting.log.at(-1)).toEqual({
      at: 3000,
      by: "Vadim",
      byRole: "admin",
      text: "משתמש אישר עדכון פגישה שהוכן על ידי AI: at",
      kind: "ai_confirmed_meeting_update"
    });
  });

  it("prepares a confirmed AI task update with an allow-listed patch and audit log", () => {
    const { task, changes } = prepareAiTaskUpdateForSave(taskUpdateAction, existingTask, { name: "Vadim", role: "admin" }, { now: 3000 });

    expect(task).toMatchObject({
      id: "task-1",
      title: "בדיקת ספק",
      priority: "high",
      status: "in_progress",
      updatedAt: 3000,
      ai: {
        source: "ai_assist",
        lastConfirmedAction: "update_task_priority",
        lastConfirmedAt: 3000
      }
    });
    expect(task.id).toBe("task-1");
    expect(changes).toEqual([
      { field: "priority", before: "medium", after: "high" },
      { field: "status", before: "todo", after: "in_progress" }
    ]);
    expect(task.log.at(-1)).toEqual({
      at: 3000,
      by: "Vadim",
      byRole: "admin",
      text: "משתמש אישר עדכון משימה שהוכן על ידי AI: priority, status",
      kind: "ai_confirmed_task_update"
    });
  });

  it("allows confirmed AI task due date updates through the same saveTask path", () => {
    const { task, changes } = prepareAiTaskUpdateForSave(taskDueUpdateAction, { ...existingTask, dueAt: null }, { name: "Vadim", role: "admin" }, { now: 4000 });

    expect(task).toMatchObject({
      id: "task-1",
      dueAt: 86402000,
      updatedAt: 4000,
      ai: {
        source: "ai_assist",
        lastConfirmedAction: "update_task_due",
        lastConfirmedAt: 4000
      }
    });
    expect(changes).toEqual([
      { field: "dueAt", before: "", after: 86402000 }
    ]);
    expect(task.log.at(-1)).toEqual({
      at: 4000,
      by: "Vadim",
      byRole: "admin",
      text: "משתמש אישר עדכון משימה שהוכן על ידי AI: dueAt",
      kind: "ai_confirmed_task_update"
    });
  });

  it("allows confirmed AI task responsible updates through the same saveTask path", () => {
    const { task, changes } = prepareAiTaskUpdateForSave(taskResponsibleUpdateAction, { ...existingTask, responsibleIds: ["u1"] }, { name: "Vadim", role: "admin" }, { now: 5000 });

    expect(task).toMatchObject({
      id: "task-1",
      responsibleIds: ["u2"],
      updatedAt: 5000,
      ai: {
        source: "ai_assist",
        lastConfirmedAction: "update_task_responsible",
        lastConfirmedAt: 5000
      }
    });
    expect(task).not.toHaveProperty("participantIds", ["evil"]);
    expect(changes).toEqual([
      { field: "responsibleIds", before: ["u1"], after: ["u2"] }
    ]);
    expect(task.log.at(-1)).toEqual({
      at: 5000,
      by: "Vadim",
      byRole: "admin",
      text: "משתמש אישר עדכון משימה שהוכן על ידי AI: responsibleIds",
      kind: "ai_confirmed_task_update"
    });
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

  it("allows confirmed zone updates without accepting unsafe patch fields", () => {
    const { ticket, changes } = prepareAiTicketUpdateForSave(zoneUpdateAction, existingTicket, { name: "Vadim", role: "admin" }, { now: 3600 });

    expect(ticket).toMatchObject({
      id: "ticket-1",
      zone: "משרדים",
      updatedAt: 3600,
      ai: {
        source: "ai_assist",
        lastConfirmedAction: "update_ticket_zone",
        lastConfirmedAt: 3600
      }
    });
    expect(ticket.log).toEqual([
      { at: 1500, by: "Dana", byRole: "user", text: "נוצרה", kind: "created" },
      {
        at: 3600,
        by: "Vadim",
        byRole: "admin",
        text: "משתמש אישר עדכון קריאה שהוכן על ידי AI: zone",
        kind: "ai_confirmed_update"
      }
    ]);
    expect(changes).toEqual([
      { field: "zone", before: "קבלה", after: "משרדים" }
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

  it("does not default an AI ticket form prefill to medium priority", () => {
    expect(ticketPrefillFromAiAssistAction({
      ...readyAction,
      payload: { track: "facility", subject: "Door", description: "Stuck", category: "doors" }
    })).toMatchObject({ priority: "" });
  });

  it("preserves validated facility category and neutral priority in TicketForm prefill", () => {
    const prefill = ticketPrefillFromAiAssistAction({
      ...readyAction,
      payload: {
        track: "facility",
        subject: "מזגן לא עובד בחדר מפעיל מערכת",
        description: "דווח כי המזגן בחדר מפעיל מערכת אינו עובד. יש לבדוק את התקלה.",
        category: "hvac",
        priority: "medium",
        zone: "משרדים"
      }
    });

    expect(prefill).toMatchObject({
      track: "facility",
      subject: "מזגן לא עובד בחדר מפעיל מערכת",
      description: "דווח כי המזגן בחדר מפעיל מערכת אינו עובד. יש לבדוק את התקלה.",
      category: "hvac",
      priority: "medium",
      zone: "משרדים"
    });
  });
});
