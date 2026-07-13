import { describe, expect, it } from "vitest";
import { aiAssistantFailureMessage, aiUpdatePreviewRows, normalizeAiPanelAssistantOutput, shouldRequestProviderPlan } from "../src/AIPanel.jsx";
import { AI_ASSIST_WORKFLOWS } from "../src/aiAssistWorkflowModel.js";

describe("AI panel response model", () => {
  it("keeps legacy string assistant responses working", () => {
    expect(normalizeAiPanelAssistantOutput("תשובה קצרה")).toEqual({
      text: "תשובה קצרה",
      actions: [],
      providerPlan: null,
      providerPlanErrorCode: ""
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
      actions: [action],
      providerPlan: null,
      providerPlanErrorCode: ""
    });
  });

  it("preserves sanitized provider plans from the server assistant", () => {
    const providerPlan = {
      summary: "תוכנית מוצעת",
      writesData: false,
      items: [{ id: "provider_plan_1", type: "ticket.update", title: "בדיקת קריאה" }]
    };

    expect(normalizeAiPanelAssistantOutput({
      text: "יש תוכנית.",
      providerPlan,
      providerPlanErrorCode: "ai_provider_quota_exceeded"
    })).toEqual({
      text: "יש תוכנית.",
      actions: [],
      providerPlan,
      providerPlanErrorCode: "ai_provider_quota_exceeded"
    });
  });

  it("requests provider plans only for action-oriented workflows", () => {
    expect(shouldRequestProviderPlan(AI_ASSIST_WORKFLOWS.nextActions)).toBe(true);
    expect(shouldRequestProviderPlan(AI_ASSIST_WORKFLOWS.riskSummary)).toBe(true);
    expect(shouldRequestProviderPlan(AI_ASSIST_WORKFLOWS.draftPreparation)).toBe(true);
    expect(shouldRequestProviderPlan(AI_ASSIST_WORKFLOWS.slaExplanation)).toBe(false);
    expect(shouldRequestProviderPlan(AI_ASSIST_WORKFLOWS.general)).toBe(false);
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

  it("formats responsible previews with display names instead of raw ids", () => {
    expect(aiUpdatePreviewRows({
      type: "task.update",
      payload: {
        current: { responsibleIds: ["u1"] },
        patch: { responsibleIds: ["u2"] },
        display: { responsibleIds: { before: ["Vadim"], after: ["דנה כהן"] } }
      }
    })).toEqual([
      { field: "responsibleIds", label: "אחראים", before: "Vadim", after: "דנה כהן" }
    ]);
  });

  it("explains server AI configuration failures instead of reporting a generic network issue", () => {
    expect(aiAssistantFailureMessage(new Error("ai_server_disabled"))).toContain("CMMS_AI_MODE=server");
    expect(aiAssistantFailureMessage(new Error("ai_provider_key_required"))).toContain("מפתח API");
    expect(aiAssistantFailureMessage(new Error("ai_provider_quota_exceeded"))).toContain("מכסת ספק ה-AI");
    expect(aiAssistantFailureMessage(new Error("ai_assist_rate_limited"))).toContain("בעוד רגע");
  });
});
