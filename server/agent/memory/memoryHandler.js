import { aiMemoryAuditEvent, AUDIT_ACTIONS } from "../../../src/auditEventModel.js";
import {
  AI_MEMORY_STATUSES,
  aiMemoryFactForClient,
  aiMemoryPilotEnabled,
  aiMemorySameBusinessFact,
  normalizeAiMemoryFactInput,
  normalizeAiMemoryFactRow
} from "../../../src/aiMemoryModel.js";
import { sendJson, sendServerError } from "../../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../../audit/supabaseAuditDriver.js";
import { createSupabaseFleetDriverFromEnv } from "../../fleet/supabaseFleetDriver.js";
import { authorizeAiRequest } from "../../ai/auth.js";
import { createSupabaseAiMemoryStoreFromEnv } from "./memoryStore.js";
import {
  assertMemoryReadAllowed,
  assertMemoryWriteAllowed,
  memoryScopeAllowedForRead,
  visibleMemoryFactsForActor
} from "./memoryPolicy.js";

const MAX_BODY_BYTES = 32_000;

const cleanText = (value, limit = 240) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req?.[Symbol.asyncIterator] !== "function") return {};
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) throw new Error("payload_too_large");
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("invalid_json");
  }
};

const firstHeaderValue = (value) => Array.isArray(value) ? value[0] : value;

function requestIdForMemory(req = {}, body = {}) {
  return cleanText(
    firstHeaderValue(req.headers?.["x-request-id"])
      || firstHeaderValue(req.headers?.["x-correlation-id"])
      || body.requestId
      || body.request_id,
    200
  );
}

async function loadFleet(fleetDriver) {
  if (!fleetDriver || typeof fleetDriver.list !== "function") return [];
  return fleetDriver.list({ limit: 2000 });
}

async function writeAudit(auditDriver, event) {
  if (!auditDriver || typeof auditDriver.write !== "function" || !event) return;
  await auditDriver.write(event);
}

export function createAiMemoryHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  sessionClient = null,
  pinSessionClient = null,
  memoryStore = null,
  auditDriver = null,
  fleetDriver = null,
  now = () => Date.now()
} = {}) {
  const backendMemoryStore = memoryStore || createSupabaseAiMemoryStoreFromEnv(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);
  const backendFleetDriver = fleetDriver || createSupabaseFleetDriverFromEnv(env, fetchImpl);

  return async function aiMemoryHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
      res.setHeader("allow", "GET, POST, PATCH, DELETE");
      return sendJson(res, 405, { error: "method_not_allowed" });
    }

    const auth = await authorizeAiRequest(req, env, fetchImpl, sessionClient, pinSessionClient);
    if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });
    if (!aiMemoryPilotEnabled(env)) return sendJson(res, 404, { error: "ai_memory_pilot_disabled" });
    if (!backendMemoryStore) return sendJson(res, 503, { error: "ai_memory_store_unavailable" });

    let body = {};
    let requestId = "";
    let auditFact = null;
    let auditAction = AUDIT_ACTIONS.use;
    try {
      body = method === "GET" ? {} : await readBody(req);
      requestId = requestIdForMemory(req, body);
      const fleet = await loadFleet(backendFleetDriver);

      if (method === "GET") {
        const factId = cleanText(req.query?.id || req.query?.factId || req.query?.fact_id, 120);
        if (factId) {
          const fact = await backendMemoryStore.get(factId);
          if (!fact || !memoryScopeAllowedForRead(auth.user, fact, { fleet })) return sendJson(res, 404, { error: "memory_fact_not_found" });
          return sendJson(res, 200, { ok: true, fact: aiMemoryFactForClient(fact) });
        }
        const facts = visibleMemoryFactsForActor(auth.user, await backendMemoryStore.list({ limit: 500 }), { fleet })
          .map(aiMemoryFactForClient);
        if (facts.length) {
          await writeAudit(backendAuditDriver, aiMemoryAuditEvent({
            fact: { id: "retrieval", scopeType: "mixed", scopeId: "visible", factType: "retrieval", summary: "Retrieved AI memory facts" },
            action: AUDIT_ACTIONS.use,
            outcome: "ok",
            requestId,
            usedFactIds: facts.map((fact) => fact.id)
          }, auth.user, { at: now() }));
        }
        return sendJson(res, 200, { ok: true, facts });
      }

      if (method === "POST") {
        const fact = normalizeAiMemoryFactInput(body.fact || body, auth.user, { now });
        auditFact = fact;
        auditAction = AUDIT_ACTIONS.create;
        assertMemoryWriteAllowed(auth.user, fact, { fleet });
        const existingFacts = await backendMemoryStore.list({ limit: 500 });
        const replayed = existingFacts
          .map(normalizeAiMemoryFactRow)
          .find((existing) => aiMemorySameBusinessFact(existing, fact));
        if (replayed) {
          await writeAudit(backendAuditDriver, aiMemoryAuditEvent({
            fact: replayed,
            action: AUDIT_ACTIONS.use,
            outcome: "replayed",
            requestId
          }, auth.user, { at: now() }));
          return sendJson(res, 200, { ok: true, action: "replayed", fact: aiMemoryFactForClient(replayed) });
        }
        const saved = await backendMemoryStore.create(fact);
        await writeAudit(backendAuditDriver, aiMemoryAuditEvent({
          fact: saved,
          action: AUDIT_ACTIONS.create,
          outcome: "ok",
          requestId
        }, auth.user, { at: now() }));
        return sendJson(res, 201, { ok: true, action: "created", fact: aiMemoryFactForClient(saved) });
      }

      const factId = cleanText(body.id || body.factId || body.fact_id || req.query?.id, 120);
      if (!factId) return sendJson(res, 400, { error: "memory_fact_id_required" });
      const existing = await backendMemoryStore.get(factId);
      if (!existing) return sendJson(res, 404, { error: "memory_fact_not_found" });
      auditFact = existing;
      auditAction = method === "PATCH" ? AUDIT_ACTIONS.update : AUDIT_ACTIONS.deactivate;
      assertMemoryReadAllowed(auth.user, existing, { fleet });
      assertMemoryWriteAllowed(auth.user, existing, { fleet });

      if (method === "PATCH") {
        const nextVersion = normalizeAiMemoryFactInput({
          ...existing,
          ...(body.fact || body),
          version: Number(existing.version || 1) + 1,
          supersedesId: existing.id
        }, auth.user, { now });
        assertMemoryWriteAllowed(auth.user, nextVersion, { fleet });
        let saved = null;
        try {
          await backendMemoryStore.update(existing.id, {
            status: AI_MEMORY_STATUSES.superseded,
            updatedBy: auth.user.id,
            updatedAt: now(),
            metadata: { ...normalizeAiMemoryFactRow(existing).metadata, supersededBy: nextVersion.id }
          });
          saved = await backendMemoryStore.create(nextVersion);
        } catch (error) {
          await backendMemoryStore.update(existing.id, {
            status: AI_MEMORY_STATUSES.active,
            updatedBy: existing.updatedBy,
            updatedAt: existing.updatedAt,
            metadata: normalizeAiMemoryFactRow(existing).metadata
          }).catch(() => {});
          throw error;
        }
        await writeAudit(backendAuditDriver, aiMemoryAuditEvent({
          fact: saved,
          action: AUDIT_ACTIONS.update,
          outcome: "ok",
          requestId
        }, auth.user, { at: now(), before: aiMemoryFactForClient(existing) }));
        return sendJson(res, 200, { ok: true, action: "updated", fact: aiMemoryFactForClient(saved), supersededFactId: existing.id });
      }

      const deactivated = await backendMemoryStore.update(existing.id, {
        status: AI_MEMORY_STATUSES.deactivated,
        updatedBy: auth.user.id,
        updatedAt: now(),
        deactivatedAt: now(),
        metadata: { ...normalizeAiMemoryFactRow(existing).metadata, deactivatedReason: cleanText(body.reason, 160) }
      });
      await writeAudit(backendAuditDriver, aiMemoryAuditEvent({
        fact: deactivated,
        action: AUDIT_ACTIONS.deactivate,
        outcome: "ok",
        reason: cleanText(body.reason, 160),
        requestId
      }, auth.user, { at: now(), before: aiMemoryFactForClient(existing) }));
      return sendJson(res, 200, { ok: true, fact: aiMemoryFactForClient(deactivated) });
    } catch (error) {
      if (error?.message === "payload_too_large") return sendJson(res, 413, { error: "payload_too_large" });
      if (error?.message === "invalid_json") return sendJson(res, 400, { error: "invalid_json" });
      if (error?.message === "memory_scope_forbidden") {
        await writeAudit(backendAuditDriver, aiMemoryAuditEvent({
          fact: auditFact || { id: "blocked", scopeType: body?.fact?.scopeType || body?.scopeType, scopeId: body?.fact?.scopeId || body?.scopeId, factType: body?.fact?.factType || body?.fact_type },
          action: auditAction,
          outcome: "blocked",
          reason: "memory_scope_forbidden",
          requestId
        }, auth.user, { at: now() })).catch(() => {});
        return sendJson(res, 403, { error: "memory_scope_forbidden" });
      }
      if (error?.message === "memory_summary_required" || error?.message === "memory_scope_required") return sendJson(res, 400, { error: error.message });
      return sendServerError(req, res, error, { code: "ai_memory_error", route: "/api/ai/memory" });
    }
  };
}

export default createAiMemoryHandler();
