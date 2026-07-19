import { describe, expect, it } from "vitest";
import { AI_ASSIST_WORKFLOWS } from "../src/aiAssistWorkflowModel.js";
import {
  beginAiAgentAction,
  beginAiAgentSend,
  buildAiAgentRequest,
  completeAiAgentAction,
  completeAiAgentSend,
  createAiAgentInitialState,
  failAiAgentAction,
  failAiAgentSend
} from "../src/aiAgentSessionController.js";

describe("AI agent session controller", () => {
  const session = { name: "Dana", role: "user" };

  it("owns the current in-memory conversation state", () => {
    expect(createAiAgentInitialState({ session, initialText: "פתח קריאה", initialWorkflow: AI_ASSIST_WORKFLOWS.draftPreparation })).toMatchObject({
      input: "פתח קריאה",
      inputWorkflow: AI_ASSIST_WORKFLOWS.draftPreparation,
      busy: false,
      actionBusy: "",
      actionResults: {}
    });
  });

  it("builds the same outgoing request shape and recent-message order", () => {
    const state = createAiAgentInitialState({ session });
    const { state: sending, request } = beginAiAgentSend(state, {
      text: "מה דחוף?",
      workflow: AI_ASSIST_WORKFLOWS.nextActions,
      context: { tickets: [{ id: "t1" }] }
    });

    expect(sending.input).toBe("");
    expect(sending.inputWorkflow).toBe(AI_ASSIST_WORKFLOWS.general);
    expect(sending.busy).toBe(true);
    expect(sending.msgs.map((message) => message.role)).toEqual(["assistant", "user"]);
    expect(request).toEqual({
      text: "מה דחוף?",
      messages: [{ role: "user", content: "מה דחוף?" }],
      system: "אתה עוזר אחזקה במרכז לוגיסטי בישראל. ענה בעברית בקצרה על בסיס הקונטקסט המסונן בלבד.",
      context: { tickets: [{ id: "t1" }] },
      workflow: AI_ASSIST_WORKFLOWS.nextActions,
      includeProviderPlan: true
    });
  });

  it("keeps string contexts on the legacy text-system prompt path", () => {
    const request = buildAiAgentRequest({
      text: "סכם",
      messages: [{ role: "assistant", content: "שלום" }, { role: "user", content: "סכם" }],
      context: "קריאות בתחום ראייתך: 1",
      workflow: AI_ASSIST_WORKFLOWS.general
    });

    expect(request.messages).toEqual([{ role: "user", content: "סכם" }]);
    expect(request.system).toContain("--- נתונים ---\nקריאות בתחום ראייתך: 1");
    expect(request.includeProviderPlan).toBe(false);
  });

  it("does not start a second request while busy", () => {
    const state = { ...createAiAgentInitialState({ session }), busy: true, input: "שאלה" };

    expect(beginAiAgentSend(state, { context: {} })).toEqual({ state, request: null });
  });

  it("preserves panel close/open behavior by resetting in-memory messages on a new session instance", () => {
    const firstOpen = createAiAgentInitialState({ session });
    const sent = completeAiAgentSend(beginAiAgentSend(firstOpen, { text: "בדיקה", context: {} }).state, "תשובה");
    const reopened = createAiAgentInitialState({ session });

    expect(sent.msgs).toHaveLength(3);
    expect(reopened.msgs).toHaveLength(1);
    expect(reopened.msgs[0]).toEqual(firstOpen.msgs[0]);
  });

  it("appends normalized assistant output and displays server errors as before", () => {
    const started = beginAiAgentSend(createAiAgentInitialState({ session }), {
      text: "פתח",
      context: {}
    }).state;

    const completed = completeAiAgentSend(started, {
      text: "הכנתי טיוטה",
      actions: [{ id: "a1", type: "ticket.create" }],
      memoryCitations: [{ id: "mem-1", summary: "עובדה", scopeLabel: "Personal", sourceLabel: "AI chat" }],
      memoryGrounding: { usedMemoryIds: ["mem-1"] },
      providerPlan: { summary: "תוכנית", items: [{ id: "p1" }] }
    });
    expect(completed.busy).toBe(false);
    expect(completed.msgs.at(-1)).toMatchObject({
      role: "assistant",
      content: "הכנתי טיוטה",
      actions: [{ id: "a1", type: "ticket.create" }],
      memoryCitations: [{ id: "mem-1", summary: "עובדה", scopeLabel: "Personal", sourceLabel: "AI chat" }],
      memoryGrounding: { usedMemoryIds: ["mem-1"] },
      providerPlan: { summary: "תוכנית", items: [{ id: "p1" }] }
    });

    const failed = failAiAgentSend(started, new Error("access_token_required"));
    expect(failed.busy).toBe(false);
    expect(failed.msgs.at(-1).content).toContain("נדרשת התחברות מחדש");
  });

  it("tracks confirmed action loading and result state in the controller", () => {
    const state = createAiAgentInitialState({ session });
    const { state: running, key } = beginAiAgentAction(state, { id: "create_ticket", type: "ticket.create" });
    expect(key).toBe("create_ticket");
    expect(running.actionBusy).toBe("create_ticket");
    expect(running.actionResults.create_ticket).toBeNull();

    expect(completeAiAgentAction(running, key, { message: "נשמר" }).actionResults.create_ticket).toEqual({ ok: true, message: "נשמר" });
    expect(failAiAgentAction(running, key, new Error("נכשל")).actionResults.create_ticket).toEqual({ ok: false, message: "נכשל" });
  });
});
