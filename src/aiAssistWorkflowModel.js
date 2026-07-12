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

export function aiAssistRoleGuidance(role = "") {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "admin") {
    return "For a system administrator, prioritize cross-module operational risk, configuration gaps, stuck ownership, failed integrations, and what should be checked next. Mention affected modules and safe next steps, but do not claim to change settings or records.";
  }
  if (normalized === "executive") {
    return "For executive leadership, summarize business impact, SLA exposure, blocked work, cost or downtime signals when present, and decisions that need management attention. Avoid implementation detail unless it changes the decision.";
  }
  if (normalized === "user" || normalized === "manager") {
    return "For a department manager, focus on that manager's department, owned tickets, approvals, waiting responsibilities, and practical actions they can take now. Do not expose other departments beyond the supplied context.";
  }
  if (normalized === "tech" || normalized === "technician") {
    return "For a technician, focus on assigned or relevant work, safety, tools/parts, SLA urgency, handoff notes, and concise field-ready next actions. Do not assign work or close tickets yourself.";
  }
  if (normalized === "worker" || normalized === "cleaner") {
    return "For a worker, keep the answer simple, personal, and action-oriented. Explain what is pending for them and who should be contacted if something is outside their responsibility.";
  }
  return "Adapt the answer to the actor role supplied in the prompt while respecting the role-filtered context and read-only policy.";
}

export function aiAssistWorkflowLabel(workflow = AI_ASSIST_WORKFLOWS.general) {
  const normalized = normalizeAiAssistWorkflow(workflow);
  if (normalized === AI_ASSIST_WORKFLOWS.riskSummary) return "סיכום סיכונים";
  if (normalized === AI_ASSIST_WORKFLOWS.slaExplanation) return "הסבר SLA";
  if (normalized === AI_ASSIST_WORKFLOWS.nextActions) return "מה לעשות עכשיו";
  if (normalized === AI_ASSIST_WORKFLOWS.draftPreparation) return "הכנת טיוטה";
  return "כללי";
}
