const cleanText = (value, limit = 4000) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanArray = (value) => Array.isArray(value) ? value : [];
const cleanObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

export const AI_CAPABILITY_EXECUTION_STATUS = Object.freeze({
  blocked: "blocked",
  created: "created",
  failed: "failed",
  featureDisabled: "feature_disabled",
  permissionDenied: "permission_denied",
  replayed: "replayed"
});

export function normalizeAiCapabilityResponse(input = {}) {
  const status = Object.values(AI_CAPABILITY_EXECUTION_STATUS).includes(input.executionStatus)
    ? input.executionStatus
    : AI_CAPABILITY_EXECUTION_STATUS.failed;
  return {
    answer: cleanText(input.answer, 1200),
    facts: cleanArray(input.facts).map((item) => cleanObject(item)),
    unknowns: cleanArray(input.unknowns).map((item) => cleanText(item, 200)).filter(Boolean),
    toolResults: cleanArray(input.toolResults).map((item) => cleanObject(item)),
    actionResult: cleanObject(input.actionResult),
    blockingQuestion: cleanText(input.blockingQuestion, 600),
    requiresConfirmation: input.requiresConfirmation === true,
    executionStatus: status
  };
}
