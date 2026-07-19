import { createHash } from "crypto";
import { AUDIT_ACTIONS, aiConversationAuditEvent } from "../../../src/auditEventModel.js";
import {
  aiConversationForClient,
  aiConversationMessageForClient,
  aiConversationsAccessStatus,
  aiConversationsPilotEnabled,
  normalizeAiConversationInput
} from "../../../src/aiConversationModel.js";
import { sendJson, sendServerError } from "../../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../../audit/supabaseAuditDriver.js";
import { authorizeAiRequest } from "../../ai/auth.js";
import { createSupabaseAiConversationStoreFromEnv } from "./conversationStore.js";

const MAX_BODY_BYTES = 16_000;

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

function requestIdForConversation(req = {}, body = {}) {
  return cleanText(
    firstHeaderValue(req.headers?.["x-request-id"])
      || firstHeaderValue(req.headers?.["x-correlation-id"])
      || body.requestId
      || body.request_id,
    200
  );
}

function conversationIdempotencyKey(req = {}, body = {}) {
  return cleanText(
    body.idempotencyKey
      || body.idempotency_key
      || firstHeaderValue(req.headers?.["idempotency-key"])
      || "",
    200
  );
}

function idForConversationReplay(ownerUserId = "", idempotencyKey = "") {
  const cleanOwner = cleanText(ownerUserId, 120);
  const cleanKey = cleanText(idempotencyKey, 200);
  if (!cleanOwner || !cleanKey) return "";
  return `conv-${createHash("sha256").update(`${cleanOwner}:${cleanKey}`).digest("hex").slice(0, 32)}`;
}

async function writeAudit(auditDriver, event) {
  if (!auditDriver || typeof auditDriver.write !== "function" || !event) return;
  await auditDriver.write(event);
}

function actionForMethod(method = "GET") {
  if (method === "POST") return AUDIT_ACTIONS.create;
  if (method === "DELETE") return AUDIT_ACTIONS.deactivate;
  return AUDIT_ACTIONS.use;
}

function conversationIdFromRequest(req = {}, body = {}) {
  return cleanText(
    body.id
      || body.conversationId
      || body.conversation_id
      || req.query?.id
      || req.query?.conversationId
      || req.query?.conversation_id,
    120
  );
}

export function createAiConversationHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  sessionClient = null,
  pinSessionClient = null,
  conversationStore = null,
  auditDriver = null,
  now = () => Date.now()
} = {}) {
  const backendConversationStore = conversationStore || createSupabaseAiConversationStoreFromEnv(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function aiConversationHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (!["GET", "POST", "DELETE"].includes(method)) {
      res.setHeader("allow", "GET, POST, DELETE");
      return sendJson(res, 405, { error: "method_not_allowed" });
    }

    const auth = await authorizeAiRequest(req, env, fetchImpl, sessionClient, pinSessionClient);
    if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });
    if (!aiConversationsPilotEnabled(env)) return sendJson(res, 404, { error: "ai_conversations_pilot_disabled" });
    const access = aiConversationsAccessStatus(env, auth.user);
    if (!access.effectiveAccess) {
      await writeAudit(backendAuditDriver, aiConversationAuditEvent({
        conversation: { id: conversationIdFromRequest(req) },
        action: actionForMethod(method),
        outcome: "blocked",
        reason: "conversation_pilot_permission_required",
        requestId: requestIdForConversation(req, {})
      }, auth.user, { at: now() }));
      return sendJson(res, 403, { error: "ai_conversations_pilot_permission_required" });
    }
    if (!backendConversationStore) return sendJson(res, 503, { error: "ai_conversation_store_unavailable" });

    let body = {};
    try {
      body = method === "GET" ? {} : await readBody(req);
      const requestId = requestIdForConversation(req, body);
      const ownerUserId = cleanText(auth.user.id || auth.user.authUserId || auth.user.workerNo, 120);

      if (method === "GET") {
        const conversationId = cleanText(req.query?.id || req.query?.conversationId || req.query?.conversation_id, 120);
        if (conversationId) {
          const conversation = await backendConversationStore.getMine({ id: conversationId, ownerUserId });
          if (!conversation) {
            await writeAudit(backendAuditDriver, aiConversationAuditEvent({
              conversation: { id: conversationId },
              action: AUDIT_ACTIONS.use,
              outcome: "blocked",
              reason: "conversation_not_found",
              requestId
            }, auth.user, { at: now() }));
            return sendJson(res, 404, { error: "conversation_not_found" });
          }
          const messages = await backendConversationStore.listMessages({ conversationId: conversation.id, limit: 200 });
          await writeAudit(backendAuditDriver, aiConversationAuditEvent({
            conversation,
            action: AUDIT_ACTIONS.use,
            outcome: "ok",
            requestId,
            messageCount: messages.length
          }, auth.user, { at: now() }));
          return sendJson(res, 200, {
            ok: true,
            conversation: aiConversationForClient(conversation),
            messages: messages.map(aiConversationMessageForClient)
          });
        }
        const conversations = await backendConversationStore.listMine({ ownerUserId, limit: 12 });
        return sendJson(res, 200, { ok: true, conversations: conversations.map(aiConversationForClient) });
      }

      if (method === "POST") {
        const rawInput = body.conversation || body;
        const replayKey = conversationIdempotencyKey(req, body);
        const replayId = cleanText(rawInput.id, 120) || idForConversationReplay(ownerUserId, replayKey);
        const conversation = normalizeAiConversationInput({
          ...rawInput,
          id: replayId || rawInput.id
        }, auth.user, { now });
        if (replayId) {
          const existing = await backendConversationStore.getMine({ id: conversation.id, ownerUserId });
          if (existing) {
            await writeAudit(backendAuditDriver, aiConversationAuditEvent({
              conversation: existing,
              action: AUDIT_ACTIONS.create,
              outcome: "replayed",
              requestId
            }, auth.user, { at: now() }));
            return sendJson(res, 200, { ok: true, conversation: aiConversationForClient(existing), messages: [] });
          }
        }
        const saved = await backendConversationStore.create(conversation);
        await writeAudit(backendAuditDriver, aiConversationAuditEvent({
          conversation: saved,
          action: AUDIT_ACTIONS.create,
          outcome: "ok",
          requestId
        }, auth.user, { at: now() }));
        return sendJson(res, 201, { ok: true, conversation: aiConversationForClient(saved), messages: [] });
      }

      const conversationId = conversationIdFromRequest(req, body);
      if (!conversationId) return sendJson(res, 400, { error: "conversation_id_required" });
      const archived = await backendConversationStore.archiveMine({ id: conversationId, ownerUserId, at: now() });
      if (!archived) {
        await writeAudit(backendAuditDriver, aiConversationAuditEvent({
          conversation: { id: conversationId },
          action: AUDIT_ACTIONS.deactivate,
          outcome: "blocked",
          reason: "conversation_not_found",
          requestId
        }, auth.user, { at: now() }));
        return sendJson(res, 404, { error: "conversation_not_found" });
      }
      await writeAudit(backendAuditDriver, aiConversationAuditEvent({
        conversation: archived,
        action: AUDIT_ACTIONS.deactivate,
        outcome: "ok",
        requestId
      }, auth.user, { at: now() }));
      return sendJson(res, 200, { ok: true, conversation: aiConversationForClient(archived) });
    } catch (error) {
      if (error?.message === "payload_too_large") return sendJson(res, 413, { error: "payload_too_large" });
      if (error?.message === "invalid_json") return sendJson(res, 400, { error: "invalid_json" });
      if (error?.message === "conversation_owner_required") return sendJson(res, 400, { error: error.message });
      return sendServerError(req, res, error, { code: "ai_conversation_error", route: "/api/ai/conversations" });
    }
  };
}

export default createAiConversationHandler();
