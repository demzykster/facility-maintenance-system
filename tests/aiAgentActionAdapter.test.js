import { describe, expect, it, vi } from "vitest";
import { createAiAgentActionExecutor, createAiAgentTicketDraftEditor } from "../src/aiAgentActionAdapter.js";

describe("AI agent action adapter", () => {
  const session = { id: "u1", name: "Dana", role: "user" };

  it("keeps confirmed ticket creates on the existing saveTicket path", async () => {
    const saveTicket = vi.fn(async () => true);
    const execute = createAiAgentActionExecutor({ session, saveTicket }, {
      now: () => 1784400000000,
      makeId: () => "ticket-ai-1",
      saveFailedMessage: "save failed"
    });

    const result = await execute({
      id: "ticket-action-1",
      type: "ticket.create",
      requiresConfirmation: true,
      execute: { method: "POST", path: "/api/tickets" },
      payload: {
        subject: "נזילה",
        description: "בדיקה",
        track: "facility",
        zone: "מחסן"
      }
    });

    expect(saveTicket).toHaveBeenCalledTimes(1);
    expect(saveTicket.mock.calls[0][0]).toMatchObject({
      id: "ticket-ai-1",
      subject: "נזילה",
      track: "facility",
      zone: "מחסן"
    });
    expect(saveTicket.mock.calls[0][0].log.at(-1)).toMatchObject({ by: "Dana", kind: "ai_confirmed" });
    expect(result).toMatchObject({ ok: true, ticketId: "ticket-ai-1" });
  });

  it("keeps confirmed task updates on saveTask and existing task lookup", async () => {
    const saveTask = vi.fn(async () => true);
    const execute = createAiAgentActionExecutor({
      session,
      tasks: [{ id: "task-1", title: "ישן", status: "open" }],
      saveTask
    }, { now: () => 1784400000000 });

    const result = await execute({
      id: "task-action-1",
      type: "task.update",
      requiresConfirmation: true,
      execute: { method: "POST", path: "/api/work", resource: "tasks", bodyField: "task" },
      payload: {
        taskId: "task-1",
        patch: { priority: "high" }
      }
    });

    expect(saveTask).toHaveBeenCalledTimes(1);
    expect(saveTask.mock.calls[0][0]).toMatchObject({ id: "task-1", priority: "high" });
    expect(result.message).toContain("המשימה עודכנה");
  });

  it("opens the existing ticket draft flow for editable AI ticket proposals", () => {
    const openAiTicketDraft = vi.fn();
    const edit = createAiAgentTicketDraftEditor({ openAiTicketDraft });

    edit({
      type: "ticket.create",
      requiresConfirmation: true,
      execute: { method: "POST", path: "/api/tickets" },
      payload: {
        subject: "בדיקה",
        track: "facility"
      }
    });

    expect(openAiTicketDraft).toHaveBeenCalledWith(expect.objectContaining({
      subject: "בדיקה",
      track: "facility"
    }));
  });
});
