import {
  prepareAiCleaningComplaintCreateForSave,
  prepareAiMeetingCreateForSave,
  prepareAiMeetingUpdateForSave,
  prepareAiPpeRequestCreateForSave,
  prepareAiTaskCreateForSave,
  prepareAiTaskUpdateForSave,
  prepareAiTicketCommentForSave,
  prepareAiTicketCreateForSave,
  prepareAiTicketUpdateForSave,
  ticketPrefillFromAiAssistAction
} from "./aiAssistActionExecutionModel.js";

export function createAiAgentActionExecutor(props = {}, {
  now = Date.now,
  makeId,
  saveFailedMessage = "השמירה נכשלה. בדקו חיבור ונסו שוב."
} = {}) {
  return async function executeAiAgentAction(action) {
    if (action?.type === "meeting.create") {
      if (typeof props.saveMeeting !== "function") throw new Error("שמירת פגישות אינה זמינה במסך זה.");
      const meeting = prepareAiMeetingCreateForSave(action, props.session, { now: now(), makeId });
      const ok = await props.saveMeeting(meeting);
      if (ok === false) throw new Error(saveFailedMessage);
      return { ok: true, meetingId: meeting.id, message: `הפגישה נוצרה: ${meeting.title || meeting.id}` };
    }
    if (action?.type === "meeting.update") {
      if (typeof props.saveMeeting !== "function") throw new Error("שמירת פגישות אינה זמינה במסך זה.");
      const existing = (props.meetings || []).find((meeting) => meeting.id === action?.payload?.meetingId);
      if (!existing) throw new Error("הפגישה לעדכון לא נמצאה.");
      const { meeting, changes } = prepareAiMeetingUpdateForSave(action, existing, props.session, { now: now() });
      const ok = await props.saveMeeting(meeting);
      if (ok === false) throw new Error(saveFailedMessage);
      return { ok: true, meetingId: meeting.id, message: `הפגישה עודכנה (${changes.length} שינויים).` };
    }
    if (action?.type === "task.create") {
      if (typeof props.saveTask !== "function") throw new Error("שמירת משימות אינה זמינה במסך זה.");
      const task = prepareAiTaskCreateForSave(action, props.session, { now: now(), makeId });
      const ok = await props.saveTask(task);
      if (ok === false) throw new Error(saveFailedMessage);
      return { ok: true, taskId: task.id, message: `המשימה נוצרה: ${task.title || task.id}` };
    }
    if (action?.type === "task.update") {
      if (typeof props.saveTask !== "function") throw new Error("שמירת משימות אינה זמינה במסך זה.");
      const existing = (props.tasks || []).find((task) => task.id === action?.payload?.taskId);
      if (!existing) throw new Error("המשימה לעדכון לא נמצאה.");
      const { task, changes } = prepareAiTaskUpdateForSave(action, existing, props.session, { now: now() });
      const ok = await props.saveTask(task);
      if (ok === false) throw new Error(saveFailedMessage);
      return { ok: true, taskId: task.id, message: `המשימה עודכנה (${changes.length} שינויים).` };
    }
    if (action?.type === "ppe.request.create") {
      if (typeof props.savePpeReq !== "function") throw new Error("שמירת בקשות ביגוד אינה זמינה במסך זה.");
      const request = prepareAiPpeRequestCreateForSave(action, props.session, { now: now(), makeId });
      const ok = await props.savePpeReq(request);
      if (ok === false) throw new Error(saveFailedMessage);
      return { ok: true, requestId: request.id, message: `בקשת הביגוד נשלחה: ${request.lines?.[0]?.itemName || request.id}` };
    }
    if (action?.type === "cleaning.complaint.create") {
      if (typeof props.fileComplaint !== "function") throw new Error("שמירת דיווחי ניקיון אינה זמינה במסך זה.");
      const complaint = prepareAiCleaningComplaintCreateForSave(action, props.session, { now: now(), makeId });
      const ok = await props.fileComplaint(complaint);
      if (ok === false) throw new Error(saveFailedMessage);
      return { ok: true, complaintId: complaint.id, message: `דיווח הניקיון נשלח: ${complaint.zoneName || complaint.id}` };
    }
    if (typeof props.saveTicket !== "function") throw new Error("שמירת קריאות אינה זמינה במסך זה.");
    if (action?.type === "ticket.comment") {
      const existing = (props.tickets || []).find((ticket) => ticket.id === action?.payload?.ticketId);
      if (!existing) throw new Error("הקריאה לעדכון לא נמצאה.");
      const { ticket } = prepareAiTicketCommentForSave(action, existing, props.session, { now: now() });
      const ok = await props.saveTicket(ticket);
      if (ok === false) throw new Error(saveFailedMessage);
      return { ok: true, ticketId: ticket.id, message: "ההערה נוספה לקריאה." };
    }
    if (action?.type === "ticket.update") {
      const existing = (props.tickets || []).find((ticket) => ticket.id === action?.payload?.ticketId);
      if (!existing) throw new Error("הקריאה לעדכון לא נמצאה.");
      const { ticket, changes } = prepareAiTicketUpdateForSave(action, existing, props.session, { now: now() });
      const ok = await props.saveTicket(ticket);
      if (ok === false) throw new Error(saveFailedMessage);
      return { ok: true, ticketId: ticket.id, message: `הקריאה עודכנה (${changes.length} שינויים).` };
    }
    const ticket = prepareAiTicketCreateForSave(action, props.session, { now: now(), makeId });
    const ok = await props.saveTicket(ticket);
    if (ok === false) throw new Error(saveFailedMessage);
    return { ok: true, ticketId: ticket.id, message: `הקריאה נוצרה: ${ticket.subject || ticket.id}` };
  };
}

export function createAiAgentTicketDraftEditor({ openAiTicketDraft } = {}) {
  return function editAiAgentTicketDraft(action) {
    const prefill = ticketPrefillFromAiAssistAction(action);
    if (!prefill || typeof openAiTicketDraft !== "function") throw new Error("פתיחת טופס קריאה אינה זמינה במסך זה.");
    openAiTicketDraft(prefill);
  };
}
