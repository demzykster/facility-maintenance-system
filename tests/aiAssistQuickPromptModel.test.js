import { describe, expect, it } from "vitest";
import { AI_ASSIST_WORKFLOWS, normalizeAiAssistWorkflow } from "../src/aiAssistWorkflowModel.js";
import { aiAssistContextualPrompts, aiAssistQuickPrompts, aiAssistWelcomeMessage } from "../src/aiAssistQuickPromptModel.js";

describe("AI assist quick prompt model", () => {
  it("keeps admin quick prompts focused on risks, heatmap load, SLA, and actions", () => {
    const prompts = aiAssistQuickPrompts({ role: "admin" });

    expect(prompts.map((item) => item.text)).toEqual([
      "סכם לי את הסיכונים החשובים",
      "איפה יש עומס לפי מחלקה?",
      "הסבר מה בחריגת SLA",
      "מה הפעולות הבאות?"
    ]);
    expect(prompts.map((item) => item.workflow)).toEqual([
      AI_ASSIST_WORKFLOWS.riskSummary,
      AI_ASSIST_WORKFLOWS.riskSummary,
      AI_ASSIST_WORKFLOWS.slaExplanation,
      AI_ASSIST_WORKFLOWS.nextActions
    ]);
  });

  it("gives executives management-level prompts instead of operational drafting", () => {
    const prompts = aiAssistQuickPrompts({ role: "executive" });

    expect(prompts.map((item) => item.text)).toEqual([
      "תן לי תמונת הנהלה קצרה",
      "מה דורש החלטה ניהולית?",
      "איפה הסיכון הכי גדול לשירות?"
    ]);
    expect(prompts.some((item) => item.workflow === AI_ASSIST_WORKFLOWS.draftPreparation)).toBe(false);
    expect(aiAssistWelcomeMessage({ role: "executive" })).toContain("תמונת הנהלה");
  });

  it("gives field roles practical next-action prompts", () => {
    expect(aiAssistQuickPrompts({ role: "tech" }).map((item) => item.workflow)).toEqual([
      AI_ASSIST_WORKFLOWS.nextActions,
      AI_ASSIST_WORKFLOWS.nextActions,
      AI_ASSIST_WORKFLOWS.draftPreparation
    ]);
    expect(aiAssistQuickPrompts({ role: "worker" }).map((item) => item.text)).toContain("מה נדרש ממני עכשיו?");
    expect(aiAssistQuickPrompts({ role: "cleaner" }).map((item) => item.text)).toContain("איפה יש תלונות פתוחות?");
  });

  it("returns only known workflow ids", () => {
    for (const role of ["admin", "executive", "user", "tech", "worker", "cleaner", "unknown"]) {
      for (const item of aiAssistQuickPrompts({ role })) {
        expect(normalizeAiAssistWorkflow(item.workflow)).toBe(item.workflow);
      }
    }
  });

  it("adds contextual admin prompts from heatmap, SLA, and approvals before generic prompts", () => {
    const prompts = aiAssistQuickPrompts({ role: "admin" }, {
      metrics: { overdueTickets: 2, pendingApprovals: 3, fleetDocsDue: 4, pmDue: 1 },
      bi: { heatmap: [{ department: "הפצה", total: 5 }] }
    });

    expect(prompts.map((item) => item.text).slice(0, 3)).toEqual([
      "נתח את העומס בהפצה",
      "הסבר את 2 חריגות ה-SLA",
      "מה לאשר קודם מתוך 3 ממתינות?"
    ]);
    expect(prompts.map((item) => item.workflow).slice(0, 3)).toEqual([
      AI_ASSIST_WORKFLOWS.riskSummary,
      AI_ASSIST_WORKFLOWS.slaExplanation,
      AI_ASSIST_WORKFLOWS.nextActions
    ]);
  });

  it("keeps contextual prompts role-limited for field users", () => {
    const context = {
      metrics: { openTickets: 8, overdueTickets: 2, pmDue: 1 },
      bi: { heatmap: [{ department: "הפצה", total: 5 }] }
    };

    expect(aiAssistContextualPrompts({ role: "tech" }, context).map((item) => item.text)).toEqual([
      "מה הכי מסכן SLA בטיפול שלי?",
      "איזה טיפול תקופתי לבצע קודם?"
    ]);
    expect(aiAssistContextualPrompts({ role: "worker" }, context).map((item) => item.text)).toEqual([
      "מה קורה עם הקריאות שלי?"
    ]);
  });
});
