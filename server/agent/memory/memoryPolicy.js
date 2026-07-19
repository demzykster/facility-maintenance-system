import { AI_MEMORY_SCOPE_TYPES, AI_MEMORY_STATUSES, normalizeAiMemoryFactRow } from "../../../src/aiMemoryModel.js";
import { visibleFleetForSession, ticketUserDepartments } from "../../../src/ticketVisibilityModel.js";

const cleanText = (value, limit = 160) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const companyWide = (actor = {}) => actor.role === "admin" || actor.role === "executive";
const admin = (actor = {}) => actor.role === "admin";

function actorId(actor = {}) {
  return cleanText(actor.id || actor.authUserId || actor.auth_user_id || actor.workerNo || actor.worker_no, 120);
}

function actorDepartments(actor = {}) {
  return ticketUserDepartments(actor);
}

function visibleAssetIds(actor = {}, fleet = []) {
  return new Set(visibleFleetForSession(actor, fleet).map((unit) => cleanText(unit?.id, 120)).filter(Boolean));
}

export function memoryScopeAllowedForRead(actor = {}, scope = {}, { fleet = [] } = {}) {
  const scopeType = cleanText(scope.scopeType || scope.scope_type);
  const scopeId = cleanText(scope.scopeId || scope.scope_id, 120);
  if (!scopeType || !scopeId) return false;
  if (scopeType === AI_MEMORY_SCOPE_TYPES.personal) return scopeId === actorId(actor);
  if (scopeType === AI_MEMORY_SCOPE_TYPES.department) return companyWide(actor) || actorDepartments(actor).includes(scopeId);
  if (scopeType === AI_MEMORY_SCOPE_TYPES.organization) return companyWide(actor);
  if (scopeType === AI_MEMORY_SCOPE_TYPES.asset) return visibleAssetIds(actor, fleet).has(scopeId);
  return false;
}

export function memoryScopeAllowedForWrite(actor = {}, scope = {}, { fleet = [] } = {}) {
  const scopeType = cleanText(scope.scopeType || scope.scope_type);
  const scopeId = cleanText(scope.scopeId || scope.scope_id, 120);
  if (!scopeType || !scopeId) return false;
  if (admin(actor)) return true;
  if (scopeType === AI_MEMORY_SCOPE_TYPES.personal) return scopeId === actorId(actor);
  if (scopeType === AI_MEMORY_SCOPE_TYPES.department) return actor.role === "user" && actorDepartments(actor).includes(scopeId);
  if (scopeType === AI_MEMORY_SCOPE_TYPES.asset) return ["user", "tech"].includes(actor.role) && visibleAssetIds(actor, fleet).has(scopeId);
  return false;
}

export function visibleMemoryFactsForActor(actor = {}, facts = [], { fleet = [] } = {}) {
  return (Array.isArray(facts) ? facts : [])
    .map(normalizeAiMemoryFactRow)
    .filter((fact) => fact.status === AI_MEMORY_STATUSES.active)
    .filter((fact) => memoryScopeAllowedForRead(actor, fact, { fleet }));
}

export function assertMemoryReadAllowed(actor = {}, fact = {}, options = {}) {
  if (!memoryScopeAllowedForRead(actor, fact, options)) throw new Error("memory_scope_forbidden");
}

export function assertMemoryWriteAllowed(actor = {}, fact = {}, options = {}) {
  if (!memoryScopeAllowedForWrite(actor, fact, options)) throw new Error("memory_scope_forbidden");
}
