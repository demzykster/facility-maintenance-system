import { aiMemoryAuditEvent, AUDIT_ACTIONS } from "../../../src/auditEventModel.js";
import { aiMemoryFactForClient, aiMemoryPilotEnabled } from "../../../src/aiMemoryModel.js";
import { visibleMemoryFactsForActor } from "./memoryPolicy.js";

async function writeAudit(auditDriver, event) {
  if (!auditDriver || typeof auditDriver.write !== "function" || !event) return;
  await auditDriver.write(event);
}

export async function listMemoryFactsForContext({
  env = {},
  actor = {},
  memoryStore = null,
  fleet = [],
  auditDriver = null,
  requestId = "",
  now = () => Date.now(),
  limit = 12
} = {}) {
  if (!aiMemoryPilotEnabled(env) || !memoryStore || typeof memoryStore.list !== "function") return [];
  const visible = visibleMemoryFactsForActor(actor, await memoryStore.list({ limit: 500 }), { fleet })
    .slice(0, Math.min(Math.max(Number(limit) || 12, 1), 24))
    .map(aiMemoryFactForClient);
  if (visible.length) {
    await writeAudit(auditDriver, aiMemoryAuditEvent({
      fact: { id: "retrieval", scopeType: "mixed", scopeId: "visible", factType: "retrieval", summary: "Used AI memory facts" },
      action: AUDIT_ACTIONS.use,
      outcome: "ok",
      requestId,
      usedFactIds: visible.map((fact) => fact.id)
    }, actor, { at: now() }));
  }
  return visible;
}
