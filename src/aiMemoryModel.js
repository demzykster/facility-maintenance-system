export const AI_MEMORY_SCOPE_TYPES = Object.freeze({
  personal: "personal",
  department: "department",
  organization: "organization",
  asset: "asset"
});

export const AI_MEMORY_STATUSES = Object.freeze({
  active: "active",
  superseded: "superseded",
  deactivated: "deactivated"
});

export const AI_MEMORY_CONFIDENCE = Object.freeze({
  confirmed: "confirmed",
  inferred: "inferred",
  needsReview: "needs_review"
});

const SCOPE_TYPES = new Set(Object.values(AI_MEMORY_SCOPE_TYPES));
const STATUSES = new Set(Object.values(AI_MEMORY_STATUSES));
const CONFIDENCE = new Set(Object.values(AI_MEMORY_CONFIDENCE));
const MAX_SUMMARY = 280;
const MAX_DETAILS = 1200;

const cleanText = (value, limit = 240) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const cleanStringArray = (value, limit = 12) => (Array.isArray(value) ? value : [])
  .map((item) => cleanText(item, 80))
  .filter(Boolean)
  .slice(0, limit);

function safeMemoryMetadata(value = {}) {
  const input = cleanObject(value);
  return {
    tags: cleanStringArray(input.tags, 8)
  };
}

export function aiMemoryPilotEnabled(env = {}) {
  const raw = String(env.CMMS_AI_MEMORY_PILOT || "").trim().toLowerCase();
  return ["1", "true", "yes", "on", "enabled", "local"].includes(raw);
}

export function aiMemoryFactId({ now = Date.now, random = Math.random } = {}) {
  return `mem-${now()}-${random().toString(36).slice(2, 10)}`;
}

export function normalizeAiMemoryScope(input = {}, actor = {}) {
  const requestedType = cleanText(input.scopeType || input.scope_type || AI_MEMORY_SCOPE_TYPES.personal, 40);
  const scopeType = SCOPE_TYPES.has(requestedType) ? requestedType : AI_MEMORY_SCOPE_TYPES.personal;
  let scopeId = cleanText(input.scopeId || input.scope_id, 120);
  if (scopeType === AI_MEMORY_SCOPE_TYPES.personal) scopeId = cleanText(actor.id || actor.authUserId || actor.workerNo, 120);
  if (scopeType === AI_MEMORY_SCOPE_TYPES.department && !scopeId) {
    const departments = Array.isArray(actor.departments) ? actor.departments : Array.isArray(actor.depts) ? actor.depts : [];
    scopeId = cleanText(actor.department || actor.dept || departments[0], 120);
  }
  if (scopeType === AI_MEMORY_SCOPE_TYPES.organization && !scopeId) scopeId = "organization";
  return { scopeType, scopeId };
}

export function normalizeAiMemoryFactInput(input = {}, actor = {}, { now = Date.now, makeId = aiMemoryFactId } = {}) {
  const scope = normalizeAiMemoryScope(input, actor);
  const summary = cleanText(input.summary || input.text || input.fact, MAX_SUMMARY);
  if (!summary) throw new Error("memory_summary_required");
  if (!scope.scopeId) throw new Error("memory_scope_required");
  const requestedStatus = cleanText(input.status || AI_MEMORY_STATUSES.active, 40);
  const requestedConfidence = cleanText(input.confidence || AI_MEMORY_CONFIDENCE.confirmed, 40);
  const at = Number(now());
  const version = Math.max(Number(input.version) || 1, 1);
  return {
    id: makeId({ now: () => at }),
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
    factType: cleanText(input.factType || input.fact_type || "note", 80),
    summary,
    details: cleanText(input.details || input.detail || "", MAX_DETAILS),
    sourceType: cleanText(input.sourceType || input.source_type || "ai_chat", 80),
    sourceId: cleanText(input.sourceId || input.source_id || "", 160),
    sourceLabel: cleanText(input.sourceLabel || input.source_label || "AI chat confirmation", 160),
    confidence: CONFIDENCE.has(requestedConfidence) ? requestedConfidence : AI_MEMORY_CONFIDENCE.confirmed,
    status: STATUSES.has(requestedStatus) ? requestedStatus : AI_MEMORY_STATUSES.active,
    version,
    supersedesId: cleanText(input.supersedesId || input.supersedes_id, 120),
    createdBy: cleanText(actor.id || actor.authUserId, 120),
    updatedBy: cleanText(actor.id || actor.authUserId, 120),
    createdAt: at,
    updatedAt: at,
    deactivatedAt: null,
    metadata: safeMemoryMetadata(input.metadata)
  };
}

export function normalizeAiMemoryFactRow(row = {}) {
  const scopeType = cleanText(row.scopeType || row.scope_type, 40);
  const status = cleanText(row.status || AI_MEMORY_STATUSES.active, 40);
  const confidence = cleanText(row.confidence || AI_MEMORY_CONFIDENCE.confirmed, 40);
  return {
    id: cleanText(row.id, 120),
    scopeType: SCOPE_TYPES.has(scopeType) ? scopeType : AI_MEMORY_SCOPE_TYPES.personal,
    scopeId: cleanText(row.scopeId || row.scope_id, 120),
    factType: cleanText(row.factType || row.fact_type || "note", 80),
    summary: cleanText(row.summary, MAX_SUMMARY),
    details: cleanText(row.details, MAX_DETAILS),
    sourceType: cleanText(row.sourceType || row.source_type || "", 80),
    sourceId: cleanText(row.sourceId || row.source_id || "", 160),
    sourceLabel: cleanText(row.sourceLabel || row.source_label || "", 160),
    confidence: CONFIDENCE.has(confidence) ? confidence : AI_MEMORY_CONFIDENCE.confirmed,
    status: STATUSES.has(status) ? status : AI_MEMORY_STATUSES.active,
    version: Math.max(Number(row.version) || 1, 1),
    supersedesId: cleanText(row.supersedesId || row.supersedes_id, 120),
    createdBy: cleanText(row.createdBy || row.created_by, 120),
    updatedBy: cleanText(row.updatedBy || row.updated_by, 120),
    createdAt: row.createdAt || row.created_at ? Date.parse(row.createdAt || row.created_at) || Number(row.createdAt || row.created_at) || 0 : 0,
    updatedAt: row.updatedAt || row.updated_at ? Date.parse(row.updatedAt || row.updated_at) || Number(row.updatedAt || row.updated_at) || 0 : 0,
    deactivatedAt: row.deactivatedAt || row.deactivated_at ? Date.parse(row.deactivatedAt || row.deactivated_at) || Number(row.deactivatedAt || row.deactivated_at) || null : null,
    metadata: cleanObject(row.metadata)
  };
}

export function aiMemoryFactToRow(fact = {}) {
  return {
    id: fact.id,
    scope_type: fact.scopeType,
    scope_id: fact.scopeId,
    fact_type: fact.factType,
    summary: fact.summary,
    details: fact.details || "",
    source_type: fact.sourceType || "",
    source_id: fact.sourceId || "",
    source_label: fact.sourceLabel || "",
    confidence: fact.confidence || AI_MEMORY_CONFIDENCE.confirmed,
    status: fact.status || AI_MEMORY_STATUSES.active,
    version: fact.version || 1,
    supersedes_id: fact.supersedesId || null,
    created_by: fact.createdBy || null,
    updated_by: fact.updatedBy || null,
    created_at: fact.createdAt ? new Date(Number(fact.createdAt)).toISOString() : undefined,
    updated_at: fact.updatedAt ? new Date(Number(fact.updatedAt)).toISOString() : undefined,
    deactivated_at: fact.deactivatedAt ? new Date(Number(fact.deactivatedAt)).toISOString() : null,
    metadata: fact.metadata || {}
  };
}

export function aiMemoryFactForClient(fact = {}) {
  return {
    id: fact.id,
    scopeType: fact.scopeType,
    scopeId: fact.scopeId,
    scopeLabel: aiMemoryScopeLabel(fact),
    factType: fact.factType,
    summary: fact.summary,
    details: fact.details || "",
    sourceType: fact.sourceType || "",
    sourceId: fact.sourceId || "",
    sourceLabel: fact.sourceLabel || "",
    confidence: fact.confidence || AI_MEMORY_CONFIDENCE.confirmed,
    status: fact.status || AI_MEMORY_STATUSES.active,
    version: fact.version || 1,
    supersedesId: fact.supersedesId || "",
    updatedAt: fact.updatedAt || 0
  };
}

export function aiMemorySameBusinessFact(a = {}, b = {}) {
  const left = normalizeAiMemoryFactRow(a);
  const right = normalizeAiMemoryFactRow(b);
  return left.status === AI_MEMORY_STATUSES.active
    && right.status === AI_MEMORY_STATUSES.active
    && left.scopeType === right.scopeType
    && left.scopeId === right.scopeId
    && left.factType === right.factType
    && left.sourceType === right.sourceType
    && left.sourceId === right.sourceId
    && left.summary === right.summary
    && left.details === right.details
    && left.createdBy === right.createdBy;
}

export function aiMemoryScopeLabel(fact = {}) {
  if (fact.scopeType === AI_MEMORY_SCOPE_TYPES.personal) return "Personal";
  if (fact.scopeType === AI_MEMORY_SCOPE_TYPES.department) return `Department: ${fact.scopeId || ""}`.trim();
  if (fact.scopeType === AI_MEMORY_SCOPE_TYPES.asset) return `Asset: ${fact.scopeId || ""}`.trim();
  if (fact.scopeType === AI_MEMORY_SCOPE_TYPES.organization) return "Organization";
  return fact.scopeType || "Scope";
}
