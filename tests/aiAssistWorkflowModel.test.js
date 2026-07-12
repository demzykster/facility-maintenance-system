import { describe, expect, it } from "vitest";
import { AI_ASSIST_WORKFLOWS, aiAssistRoleGuidance, aiAssistWorkflowInstruction, aiAssistWorkflowLabel, normalizeAiAssistWorkflow } from "../src/aiAssistWorkflowModel.js";

describe("AI assist workflow model", () => {
  it("normalizes unknown workflow ids to general", () => {
    expect(normalizeAiAssistWorkflow(AI_ASSIST_WORKFLOWS.riskSummary)).toBe("risk_summary");
    expect(normalizeAiAssistWorkflow("unknown")).toBe("general");
    expect(normalizeAiAssistWorkflow("")).toBe("general");
  });

  it("provides explicit operational instructions for workflow modes", () => {
    expect(aiAssistWorkflowInstruction(AI_ASSIST_WORKFLOWS.riskSummary)).toContain("operational risks");
    expect(aiAssistWorkflowInstruction(AI_ASSIST_WORKFLOWS.slaExplanation)).toContain("SLA");
    expect(aiAssistWorkflowInstruction(AI_ASSIST_WORKFLOWS.nextActions)).toContain("3-5 practical next actions");
    expect(aiAssistWorkflowInstruction(AI_ASSIST_WORKFLOWS.draftPreparation)).toContain("Do not create");
  });

  it("has Hebrew labels for UI-oriented workflow names", () => {
    expect(aiAssistWorkflowLabel(AI_ASSIST_WORKFLOWS.nextActions)).toBe("מה לעשות עכשיו");
    expect(aiAssistWorkflowLabel("bad")).toBe("כללי");
  });

  it("provides role-specific guidance without granting write authority", () => {
    expect(aiAssistRoleGuidance("admin")).toContain("system administrator");
    expect(aiAssistRoleGuidance("executive")).toContain("business impact");
    expect(aiAssistRoleGuidance("user")).toContain("department manager");
    expect(aiAssistRoleGuidance("tech")).toContain("field-ready");
    expect(aiAssistRoleGuidance("worker")).toContain("simple");
    expect(aiAssistRoleGuidance("admin")).toContain("do not claim to change");
  });
});
