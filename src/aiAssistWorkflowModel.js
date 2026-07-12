export const AI_ASSIST_WORKFLOWS = Object.freeze({
  general: "general",
  riskSummary: "risk_summary",
  slaExplanation: "sla_explanation",
  nextActions: "next_actions",
  draftPreparation: "draft_preparation"
});

const WORKFLOW_SET = new Set(Object.values(AI_ASSIST_WORKFLOWS));

export function normalizeAiAssistWorkflow(value) {
  const workflow = String(value || "").trim();
  return WORKFLOW_SET.has(workflow) ? workflow : AI_ASSIST_WORKFLOWS.general;
}

export function aiAssistWorkflowInstruction(workflow = AI_ASSIST_WORKFLOWS.general) {
  const normalized = normalizeAiAssistWorkflow(workflow);
  if (normalized === AI_ASSIST_WORKFLOWS.riskSummary) {
    return "Summarize the most important operational risks in priority order. Use only the provided context, mention record numbers when present, and keep the answer short.";
  }
  if (normalized === AI_ASSIST_WORKFLOWS.slaExplanation) {
    return "Explain which SLA or aging items are at risk, why they matter, and what a human should check next. Do not invent missing records.";
  }
  if (normalized === AI_ASSIST_WORKFLOWS.nextActions) {
    return "Return 3-5 practical next actions grouped by responsible role. Do not claim any action has been performed.";
  }
  if (normalized === AI_ASSIST_WORKFLOWS.draftPreparation) {
    return "Prepare a human-reviewable draft or missing-information checklist. Do not create, update, approve, assign, or close records.";
  }
  return "Answer the user's question concisely and operationally using only the provided context.";
}

export function aiAssistWorkflowLabel(workflow = AI_ASSIST_WORKFLOWS.general) {
  const normalized = normalizeAiAssistWorkflow(workflow);
  if (normalized === AI_ASSIST_WORKFLOWS.riskSummary) return "סיכום סיכונים";
  if (normalized === AI_ASSIST_WORKFLOWS.slaExplanation) return "הסבר SLA";
  if (normalized === AI_ASSIST_WORKFLOWS.nextActions) return "מה לעשות עכשיו";
  if (normalized === AI_ASSIST_WORKFLOWS.draftPreparation) return "הכנת טיוטה";
  return "כללי";
}
