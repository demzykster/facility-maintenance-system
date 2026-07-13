import { describe, expect, it } from "vitest";
import { aiAssistantFailureMessage, aiUpdatePreviewRows, normalizeAiPanelAssistantOutput } from "../src/AIPanel.jsx";

describe("AI panel response model", () => {
  it("keeps legacy string assistant responses working", () => {
    expect(normalizeAiPanelAssistantOutput("תשובה קצרה")).toEqual({
      text: "תשובה קצרה",
      actions: []
    });
  });

  it("preserves structured action proposals from the server assistant", () => {
    const action = {
      id: "create_ticket",
      type: "ticket.create",
      requiresConfirmation: true,
      writesData: false
    };

    expect(normalizeAiPanelAssistantOutput({
      text: "הכנתי טיוטה.",
      actions: [action, null, "bad"]
    })).toEqual({
      text: "הכנתי טיוטה.",
      actions: [action]
    });
  });

  it("formats update action previews with before and after values", () => {
    expect(aiUpdatePreviewRows({
      type: "ticket.update",
      payload: {
        current: { supplier: "OldCo", priority: "medium" },
        patch: { supplier: "Toyota", priority: "high", ignored: "x" }
      }
    })).toEqual([
      { field: "supplier", label: "ספק", before: "OldCo", after: "Toyota" },
      { field: "priority", label: "עדיפות", before: "medium", after: "high" }
    ]);
  });

  it("formats task due-date previews as readable local dates", () => {
    const due = new Date(2026, 6, 13, 9, 30).getTime();

    expect(aiUpdatePreviewRows({
      type: "task.update",
      payload: {
        current: { dueAt: null },
        patch: { dueAt: due }
      }
    })).toEqual([
      { field: "dueAt", label: "תאריך יעד", before: "—", after: "13.07.26 09:30" }
    ]);
  });

  it("explains server AI configuration failures instead of reporting a generic network issue", () => {
    expect(aiAssistantFailureMessage(new Error("ai_server_disabled"))).toContain("CMMS_AI_MODE=server");
    expect(aiAssistantFailureMessage(new Error("ai_provider_key_required"))).toContain("מפתח API");
    expect(aiAssistantFailureMessage(new Error("ai_provider_quota_exceeded"))).toContain("מכסת OpenAI");
    expect(aiAssistantFailureMessage(new Error("ai_assist_rate_limited"))).toContain("בעוד רגע");
  });
});
