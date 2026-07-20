import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const inlineSource = readFileSync(new URL("../src/InlineAITicketCreate.jsx", import.meta.url), "utf8");
const hookSource = readFileSync(new URL("../src/useInlineAITicketSession.js", import.meta.url), "utf8");
const modelSource = readFileSync(new URL("../src/inlineAiTicketCreateModel.js", import.meta.url), "utf8");
const apiClientSource = readFileSync(new URL("../src/aiAgentApiClient.js", import.meta.url), "utf8");

describe("inline AI ticket create boundary", () => {
  it("keeps the new ticket modal integration minimal in the shell", () => {
    expect(appSource).toContain("InlineAITicketCreate");
    expect(appSource).toContain("applyAiTicketPrefill");
    expect(appSource).not.toContain("fetch(\"/api/ai/assist\"");
    expect(appSource).not.toContain("CMMS_AI_AUTONOMOUS_TICKET_CREATE");
  });

  it("uses the existing AI API client and never talks to providers or Supabase directly from the inline slice", () => {
    expect(hookSource).toContain("callAssistant(request)");
    expect(hookSource).not.toContain("createAiConversation");
    expect(hookSource).not.toContain("listAiConversations");
    expect(hookSource).not.toContain("supabase");
    expect(inlineSource).not.toContain("GOOGLE");
    expect(inlineSource).not.toContain("OPENAI");
    expect(inlineSource).not.toContain("ANTHROPIC");
  });

  it("keeps inline intake transient and out of durable conversation persistence", () => {
    expect(modelSource).toContain("inline_ticket_create");
    expect(modelSource).toContain("transient: true");
    expect(modelSource).not.toContain("conversationId");
    expect(hookSource).not.toContain("conversationId");
  });

  it("keeps current entity as a hint and preserves server-side authority", () => {
    expect(modelSource).toContain("currentEntityHintOnly");
    expect(modelSource).not.toContain("currentEntityAuthority");
    expect(modelSource).not.toContain("actor_id");
  });

  it("renders the requested Hebrew copy and compact result controls", () => {
    expect(inlineSource).toContain("פתיחת קריאה בעזרת AI");
    expect(modelSource).toContain("תארו בקצרה מה קרה");
    expect(modelSource).toContain("תארו בקצרה את התקלה");
    expect(modelSource).toContain("לדוגמה: משרדי הפצה");
    expect(modelSource).toContain("לדוגמה: מלגזה 210");
    expect(inlineSource).toContain("פתיחת הקריאה");
  });

  it("preserves autonomous server ticket results through the existing API client", () => {
    expect(apiClientSource).toContain("capabilityResponse");
  });
});
