import { describe, expect, it } from "vitest";
import { biHeatmapAiPrompt, ticketAiPrompt } from "../src/aiAssistEntryPointModel.js";
import { AI_ASSIST_WORKFLOWS } from "../src/aiAssistWorkflowModel.js";

describe("AI assist entry point model", () => {
  it("builds a general heatmap risk prompt from top rows", () => {
    const prompt = biHeatmapAiPrompt({
      rows: [
        { name: "הפצה", total: 7, primaryRisk: { label: "SLA", value: 2 } },
        { name: "קבלה", total: 3, primaryRisk: { label: "ללא תנועה", value: 1 } }
      ]
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.riskSummary);
    expect(prompt.text).toContain("נתח את מפת חום הקריאות");
    expect(prompt.text).toContain("הפצה: 7 פתוחות");
    expect(prompt.text).toContain("מוקד הסיכון המרכזי הוא SLA (2)");
    expect(prompt.text).toContain("3 הפעולות הבטוחות הבאות");
  });

  it("builds a department-focused heatmap prompt", () => {
    const prompt = biHeatmapAiPrompt({
      row: { name: "שינוע", total: 4, primaryRisk: { label: "השבתה", value: 1 } }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.riskSummary);
    expect(prompt.text).toContain("בתחום \"שינוע\"");
    expect(prompt.text).toContain("השבתה");
    expect(prompt.text).toContain("מה כדאי לבדוק קודם");
  });

  it("builds a cell-focused heatmap prompt without claiming any action", () => {
    const prompt = biHeatmapAiPrompt({
      row: { name: "מבנה", total: 5 },
      cell: { key: "stale", label: "ללא תנועה" }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.riskSummary);
    expect(prompt.text).toContain("\"ללא תנועה\"");
    expect(prompt.text).toContain("\"מבנה\"");
    expect(prompt.text).toContain("למנהל לבדוק");
  });

  it("builds an SLA-focused ticket prompt from a specific ticket", () => {
    const prompt = ticketAiPrompt({
      ticket: { subject: "מזגן חדר הפצה", asset: "F-001", assignee: "יוסי" },
      labels: {
        number: "F-001",
        status: "בטיפול",
        priority: "גבוהה",
        track: "אחזקת מבנה",
        category: "מיזוג",
        waitReason: "ממתין לספק",
        slaBreached: true,
        age: "נפתחה 11.07.26 18:00"
      }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.slaExplanation);
    expect(prompt.text).toContain("קריאה #F-001");
    expect(prompt.text).toContain("מזגן חדר הפצה");
    expect(prompt.text).toContain("ממתין לספק");
    expect(prompt.text).toContain("חריגת SLA");
    expect(prompt.text).toContain("3 הפעולות הבטוחות הבאות");
  });

  it("builds a next-action ticket prompt without claiming it changed anything", () => {
    const prompt = ticketAiPrompt({
      ticket: { id: "t1", subject: "רישיון רכב", asset: "מלגזה 120823", assignee: "" },
      labels: { status: "חדש", priority: "רגילה", track: "שינוע", slaBreached: false }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.nextActions);
    expect(prompt.text).toContain("מלגזה 120823");
    expect(prompt.text).toContain("טרם שויך");
    expect(prompt.text).toContain("לא מסומנת חריגת SLA");
    expect(prompt.text).not.toContain("עדכנתי");
  });
});
