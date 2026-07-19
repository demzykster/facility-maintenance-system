import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const aiPanelSource = readFileSync(new URL("../src/AIPanel.jsx", import.meta.url), "utf8");
const sessionHookSource = readFileSync(new URL("../src/useAIAgentSession.js", import.meta.url), "utf8");
const apiClientSource = readFileSync(new URL("../src/aiAgentApiClient.js", import.meta.url), "utf8");
const actionAdapterSource = readFileSync(new URL("../src/aiAgentActionAdapter.js", import.meta.url), "utf8");

describe("AI UI boundary extraction", () => {
  it("keeps panel state and request construction in the agent session boundary", () => {
    expect(aiPanelSource).not.toContain("useState");
    expect(aiPanelSource).not.toContain("setMsgs");
    expect(aiPanelSource).toContain("useAIAgentSession");
    expect(sessionHookSource).toContain("beginAiAgentSend");
    expect(sessionHookSource).toContain("callAssistant(request)");
    expect(sessionHookSource).toContain("callModel(request.messages, request.system, 900)");
  });

  it("keeps /api/ai/assist payload and idempotency construction outside the shell", () => {
    expect(appSource).toContain("callAiAssistApi");
    expect(appSource).not.toContain("idempotencyKey: typeof crypto");
    expect(apiClientSource).toContain("createAiAssistIdempotencyKey");
    expect(apiClientSource).toContain('source: "ui"');
    expect(apiClientSource).toContain('language: "he"');
    expect(apiClientSource).toContain('fetchImpl("/api/ai/assist"');
  });

  it("gates durable conversation controls on server-reported effective access", () => {
    expect(appSource).toContain("getAiConversationAccess");
    expect(appSource).toContain("loadConversationAccess={loadAIConversationAccess}");
    expect(aiPanelSource).toContain("conversationAccess && <AiConversationBar");
    expect(sessionHookSource).toContain("loadConversationAccess");
    expect(sessionHookSource).toContain("access?.effectiveAccess === true");
    expect(sessionHookSource).toContain("if (!conversationAccess || typeof createConversation !== \"function\")");
  });

  it("keeps human-confirmed action execution in one UI adapter instead of the monolith", () => {
    expect(appSource).toContain("createAiAgentActionExecutor");
    expect(appSource).not.toContain('if (action?.type === "task.update")');
    expect(appSource).not.toContain('if (action?.type === "ticket.update")');
    expect(actionAdapterSource).toContain('if (action?.type === "task.update")');
    expect(actionAdapterSource).toContain('if (action?.type === "ticket.update")');
    expect(actionAdapterSource).toContain("prepareAiTicketCreateForSave");
  });
});
