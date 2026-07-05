import { describe, expect, it } from "vitest";
import {
  aiIntakeOutputSchema,
  buildAiIntakeDraft,
  detectAiIntakeModule,
  detectAiIntakeSeverity,
  extractAiIntakeSignals
} from "../src/aiIntakeModel.js";

describe("aiIntakeModel", () => {
  it("classifies intake text across CMMS modules without writing data", () => {
    expect(detectAiIntakeModule("יש ניצוץ חשמל ליד קו אריזה")).toBe("safety");
    expect(detectAiIntakeModule("מלגזה לא נטענת במחסן")).toBe("transport");
    expect(detectAiIntakeModule("השירותים מלוכלכים ויש ריח")).toBe("cleaning");
    expect(detectAiIntakeModule("צריך נעלי עבודה מידה 43")).toBe("ppe");
    expect(detectAiIntakeModule("צריך לתאם פגישה לבדיקה חודשית")).toBe("task");

    const draft = buildAiIntakeDraft({ rawText: "מלגזה לא נטענת במחסן קומה 1", actor: { id: "u1", role: "user" } }, 100);
    expect(draft).toMatchObject({
      version: 1,
      createdAt: 100,
      module: "transport",
      action: "draft_ticket",
      writePolicy: "human_confirmation_required",
      allowedToWrite: false,
      audit: { required: true, eventType: "ai_intake_draft", safe: true }
    });
  });

  it("extracts risk and context signals for a smarter answer back to the user", () => {
    const draft = buildAiIntakeDraft({
      rawText: "באזור טעינה יש עשן וניצוץ חשמל, עובדים ליד המקום וצירפתי תמונה"
    });

    expect(draft.module).toBe("safety");
    expect(draft.severity).toBe("critical");
    expect(draft.signals).toMatchObject({
      hasPhotoHint: true,
      hasPeopleRisk: true,
      hasExactLocation: true
    });
    expect(draft.signals.riskWords).toEqual(expect.arrayContaining(["עשן", "ניצוץ"]));
    expect(draft.userReply).toContain("דחוף");
  });

  it("asks for missing details instead of pretending it can open a complete request", () => {
    const draft = buildAiIntakeDraft({ rawText: "משהו לא תקין" });

    expect(draft.module).toBe("unknown");
    expect(draft.severity).toBe("normal");
    expect(draft.missingInfo).toEqual(expect.arrayContaining(["module", "location"]));
    expect(draft.clarifyingQuestions.join(" ")).toContain("לאיזה תחום");
    expect(draft.action).toBe("ask_clarification");
  });

  it("detects high or critical severity deterministically before provider calls", () => {
    expect(detectAiIntakeSeverity("השער תקוע וחוסם כניסה")).toBe("high");
    expect(detectAiIntakeSeverity("fire near workers")).toBe("critical");
    expect(detectAiIntakeSeverity("צריך לבדוק בהמשך")).toBe("normal");
  });

  it("keeps a stable output schema for server/provider integration", () => {
    expect(aiIntakeOutputSchema()).toMatchObject({
      version: 1,
      writePolicy: "human_confirmation_required",
      modules: expect.arrayContaining(["facility", "transport", "cleaning", "ppe", "safety", "unknown"]),
      severities: ["low", "normal", "high", "critical"],
      actions: expect.arrayContaining(["ask_clarification", "draft_ticket", "draft_cleaning_report"])
    });
    expect(extractAiIntakeSignals("")).toMatchObject({ hasExactLocation: false, riskWords: [] });
  });
});
