import { describe, expect, it } from "vitest";
import { providerPlanPrompt, sanitizeAiProviderPlan } from "../src/aiAssistProviderPlanModel.js";

describe("AI assist provider plan model", () => {
  it("sanitizes provider plans into non-writing human-confirmed suggestions", () => {
    const plan = sanitizeAiProviderPlan({
      summary: "  אפשר לעזור   ",
      items: [
        {
          type: "ticket.update",
          title: "עדכן קריאה",
          reason: "נמצא כרטיס יחיד",
          confidence: 2,
          missingFields: ["אישור מנהל"],
          reviewNotes: ["בדוק לפני שמירה"],
          execute: { method: "POST", path: "/api/tickets" },
          writesData: true
        },
        { type: "ppe.request.create", title: "פתח בקשת ביגוד", confidence: 0.7 },
        { type: "sql.delete", title: "drop users" },
        { type: "question", title: "איזה כלי?", confidence: -1 }
      ]
    });

    expect(plan).toEqual({
      summary: "אפשר לעזור",
      requiresConfirmation: true,
      writesData: false,
      writePolicy: "human_confirmation_required",
      providerTextTrusted: false,
      items: [
        {
          id: "provider_plan_1",
          type: "ticket.update",
          title: "עדכן קריאה",
          reason: "נמצא כרטיס יחיד",
          confidence: 1,
          missingFields: ["אישור מנהל"],
          reviewNotes: ["בדוק לפני שמירה"],
          requiresConfirmation: true,
          writesData: false,
          writePolicy: "human_confirmation_required"
        },
        {
          id: "provider_plan_2",
          type: "ppe.request.create",
          title: "פתח בקשת ביגוד",
          reason: "",
          confidence: 0.7,
          missingFields: [],
          reviewNotes: [],
          requiresConfirmation: true,
          writesData: false,
          writePolicy: "human_confirmation_required"
        },
        {
          id: "provider_plan_4",
          type: "question",
          title: "איזה כלי?",
          reason: "",
          confidence: 0,
          missingFields: [],
          reviewNotes: [],
          requiresConfirmation: true,
          writesData: false,
          writePolicy: "human_confirmation_required"
        }
      ]
    });
    expect(JSON.stringify(plan)).not.toContain("/api/tickets");
    expect(JSON.stringify(plan)).not.toContain("sql.delete");
  });

  it("builds a prompt that states the non-writing contract", () => {
    const prompt = providerPlanPrompt({
      draft: { module: "transport" },
      actions: [{ id: "create_ticket", type: "ticket.create", status: "needs_human_input", missingFields: ["forkliftId"] }],
      context: { tickets: [{ id: "T-1" }] },
      workflow: "next_actions"
    });

    const parsed = JSON.parse(prompt);
    expect(parsed.contract.allowedToWrite).toBe(false);
    expect(parsed.contract.forbidden).toContain("Do not include executable API paths.");
    expect(parsed.deterministicActions).toEqual([
      { id: "create_ticket", type: "ticket.create", status: "needs_human_input", missingFields: ["forkliftId"] }
    ]);
  });
});
