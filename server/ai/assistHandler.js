import { aiAssistAuditEvent } from "../../src/auditEventModel.js";
import { buildAiIntakeDraft } from "../../src/aiIntakeModel.js";
import { buildAiAssistActionProposals } from "../../src/aiAssistActionModel.js";
import { buildAiAssistContext } from "../../src/aiAssistContextModel.js";
import { AI_PROVIDER_PLAN_SCHEMA, providerPlanPrompt, sanitizeAiProviderPlan } from "../../src/aiAssistProviderPlanModel.js";
import { aiAssistRoleGuidance, aiAssistWorkflowInstruction, normalizeAiAssistWorkflow } from "../../src/aiAssistWorkflowModel.js";
import { AI_MODES, aiServerConfigFromEnv, publicAiServerStatusFromEnv } from "../../src/aiProviderModel.js";
import { sendJson, sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { authorizeAiRequest } from "./auth.js";
import { callAiProvider, callAiProviderObject } from "./providerClient.js";

const MAX_BODY_BYTES = 64_000;
const MAX_TEXT_CHARS = 2_000;
const DEFAULT_RATE_LIMIT_MS = 10_000;
const AI_ASSIST_RATE_BUCKETS = new Map();

const cleanText = (value, limit = MAX_TEXT_CHARS) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanAssistantText = (value, limit = 4_000) => String(value || "")
  .replace(/\r\n?/g, "\n")
  .replace(/[ \t\f\v]+/g, " ")
  .replace(/\n{3,}/g, "\n\n")
  .trim()
  .slice(0, limit);

const cleanConversationMessages = (value) => {
  if (!Array.isArray(value)) return [];
  const messages = value
    .map((message) => {
      const role = String(message?.role || "").trim();
      if (!["user", "assistant"].includes(role)) return null;
      const content = cleanText(message?.content, 1_000);
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);
  const firstUserIndex = messages.findIndex((message) => message.role === "user");
  if (firstUserIndex < 0) return [];
  return messages.slice(firstUserIndex).slice(-6);
};

function aiProviderErrorCode(error = "") {
  const raw = cleanText(error, 800).toLowerCase();
  if (!raw) return "ai_provider_failed";
  if (/quota|billing|insufficient_quota|exceeded your current quota|plan and billing/i.test(raw)) return "ai_provider_quota_exceeded";
  if (/model|not found|does not exist|unsupported/i.test(raw)) return "ai_provider_model_unavailable";
  if (/key|api.?key|unauthorized|permission|forbidden|401|403/i.test(raw)) return "ai_provider_auth_failed";
  if (/rate.?limit|429/i.test(raw)) return "ai_provider_rate_limited";
  return "ai_provider_failed";
}

const safeLanguage = (value) => {
  const language = String(value || "he").trim().toLowerCase().replace("_", "-").split("-")[0];
  return ["he", "en", "ru", "ar", "hi", "ti"].includes(language) ? language : "he";
};

const LANGUAGE_NAMES = Object.freeze({
  he: "Hebrew",
  en: "English",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  ti: "Tigrinya"
});

function detectLanguageFromText(text = "") {
  const raw = String(text || "");
  if (!raw.trim()) return "";
  if (/[\u0400-\u04FF]/u.test(raw)) return "ru";
  if (/[\u0590-\u05FF]/u.test(raw)) return "he";
  if (/[\u0600-\u06FF]/u.test(raw)) return "ar";
  if (/[\u0900-\u097F]/u.test(raw)) return "hi";
  if (/[\u1200-\u137F]/u.test(raw)) return "ti";
  if (/[A-Za-z]/.test(raw)) return "en";
  return "";
}

function responseLanguageForRequest({ text = "", conversation = [], fallback = "he" } = {}) {
  const latestUser = [...conversation].reverse().find((message) => message.role === "user")?.content || text;
  const detected = safeLanguage(detectLanguageFromText(latestUser) || fallback);
  return {
    code: detected,
    name: LANGUAGE_NAMES[detected] || LANGUAGE_NAMES.he,
    source: detectLanguageFromText(latestUser) ? "latest_user_message" : "request_language"
  };
}

const safeSource = (value) => {
  const source = String(value || "ui").trim();
  return ["ui", "worker", "cleaner", "mobile", "test"].includes(source) ? source : "ui";
};

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

function rateLimitError({ user, env, now, buckets }) {
  const configuredMs = env.CMMS_AI_ASSIST_RATE_LIMIT_MS === undefined ? NaN : Number(env.CMMS_AI_ASSIST_RATE_LIMIT_MS);
  const rateLimitMs = Number.isFinite(configuredMs) ? configuredMs : DEFAULT_RATE_LIMIT_MS;
  if (rateLimitMs <= 0) return "";
  const key = `aiAssist:${user.id || user.authUserId || user.workerNo || "unknown"}`;
  const last = Number(buckets.get(key) || 0);
  if (last && now - last < rateLimitMs) return "ai_assist_rate_limited";
  buckets.set(key, now);
  return "";
}

function requestToDraftInput(body = {}, user = {}) {
  const rawText = cleanText(body.rawText || body.text || body.description);
  if (!rawText) return { ok: false, status: 400, error: "text_required" };
  return {
    ok: true,
    input: {
      rawText,
      module: body.module,
      severity: body.severity,
      source: safeSource(body.source),
      language: safeLanguage(body.language),
      actor: {
        type: "authenticated",
        id: cleanText(user.id || user.authUserId || user.workerNo, 80),
        role: cleanText(user.role, 40),
        name: cleanText(user.name, 120)
      }
    }
  };
}

function providerPrompt({ draft, user, context, workflow, conversation = [], responseLanguage }) {
  const safeWorkflow = normalizeAiAssistWorkflow(workflow);
  const language = responseLanguage || responseLanguageForRequest({ text: draft?.rawText, conversation, fallback: draft?.language });
  return JSON.stringify({
    contract: {
      writePolicy: "human_confirmation_required",
      allowedToWrite: false,
      expectedOutput: `Answer in ${language.name}; answer the current userRequest first, then use context only when relevant.`,
      formatPolicy: "Use short paragraphs or a compact bullet list. No dense wall of text. Avoid Markdown tables. Use at most one short heading when useful.",
      tonePolicy: "Sound like a calm human colleague, not a machine report. If the user asks a simple question, answer simply. Use operational detail only when it helps.",
      contextPolicy: "use only the role-filtered context below; never infer records that are not present",
      refusalPolicy: "If the current userRequest is unclear, ask one precise follow-up question instead of summarizing unrelated context."
    },
    responseLanguage: language,
    userRequest: cleanText(draft?.rawText, MAX_TEXT_CHARS),
    recentConversation: conversation,
    workflow: {
      id: safeWorkflow,
      instruction: aiAssistWorkflowInstruction(safeWorkflow)
    },
    roleGuidance: aiAssistRoleGuidance(user.role),
    actor: {
      role: user.role || "",
      department: user.department || user.dept || "",
      departments: user.departments || user.depts || []
    },
    context,
    draft
  });
}

const writeAuditEvent = async (auditDriver, event) => {
  if (!auditDriver || !event) return;
  if (typeof auditDriver.write === "function") return auditDriver.write(event);
};

const SYSTEM_PROMPT = [
  "You are the server-side CMMS assistant.",
  "You must be read-only: do not claim that you created, updated, deleted, assigned, approved, or closed anything.",
  "Use the deterministic draft as the source of truth.",
  "Reply to the latest user message, not to an older topic from the conversation.",
  "Reply in the latest user message language when possible.",
  "Sound like a calm human colleague, not a ticketing bot or a formal report generator.",
  "Keep the reply concise, operational, and easy to scan.",
  "If information is missing, ask the missing questions.",
  "Prefer 2-4 short paragraphs or compact bullets over one dense paragraph."
].join(" ");

export function createAiAssistHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  sessionClient = null,
  pinSessionClient = null,
  auditDriver = null,
  providerCall = callAiProvider,
  providerObjectCall = callAiProviderObject,
  now = () => Date.now(),
  rateBuckets = AI_ASSIST_RATE_BUCKETS
} = {}) {
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);
  return async function aiAssistHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "POST") {
      res.setHeader("allow", "POST");
      return sendJson(res, 405, { error: "method_not_allowed" });
    }

    const auth = await authorizeAiRequest(req, env, fetchImpl, sessionClient, pinSessionClient);
    if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });

    try {
      const currentTime = now();
      const rateError = rateLimitError({ user: auth.user, env, now: currentTime, buckets: rateBuckets });
      if (rateError) return sendJson(res, 429, { error: rateError });

      const body = await readBody(req);
      const normalized = requestToDraftInput(body, auth.user);
      if (!normalized.ok) return sendJson(res, normalized.status, { error: normalized.error });
      const workflow = normalizeAiAssistWorkflow(body.workflow);
      const conversation = cleanConversationMessages(body.messages);
      const responseLanguage = responseLanguageForRequest({
        text: normalized.input.rawText,
        conversation,
        fallback: normalized.input.language
      });

      const context = buildAiAssistContext(body.context, auth.user);
      const draft = buildAiIntakeDraft(normalized.input, currentTime);
      const actions = buildAiAssistActionProposals({ draft, user: auth.user, now: currentTime, context });
      const config = aiServerConfigFromEnv(env);
      if (config.mode !== AI_MODES.server) {
        return sendJson(res, 503, { error: "ai_server_disabled", draft, actions });
      }
      const readiness = publicAiServerStatusFromEnv(env);
      if (!readiness.serverReady) {
        return sendJson(res, 503, { error: readiness.errors[0] || "ai_server_not_ready", draft, actions });
      }

      const result = await providerCall({
        config,
        system: SYSTEM_PROMPT,
        prompt: providerPrompt({ draft, user: auth.user, context, workflow, conversation, responseLanguage }),
        fetchImpl,
        maxTokens: Number(env.CMMS_AI_ASSIST_MAX_TOKENS || 700) || 700
      });
      if (!result?.ok) {
        await writeAuditEvent(backendAuditDriver, aiAssistAuditEvent({
          draft,
          context,
          provider: config.provider || "",
          model: config.model || "",
          providerStatus: "failed",
          workflow
        }, auth.user, { at: currentTime }));
        return sendJson(res, 502, {
          error: "ai_provider_failed",
          provider: config.provider || "",
          providerErrorCode: aiProviderErrorCode(result.error),
          draft
        });
      }

      let providerPlan = null;
      let providerPlanErrorCode = "";
      if (body.includeProviderPlan === true || body.structuredPlan === true) {
        const planResult = await providerObjectCall({
          config,
          system: SYSTEM_PROMPT,
          prompt: providerPlanPrompt({ draft, actions, context, workflow, conversation }),
          schema: AI_PROVIDER_PLAN_SCHEMA,
          schemaName: "cmms_ai_non_writing_action_plan",
          schemaDescription: "Non-writing CMMS assistant plan. It must never execute or persist changes.",
          fetchImpl,
          maxTokens: Number(env.CMMS_AI_PLAN_MAX_TOKENS || 900) || 900
        });
        if (planResult?.ok) {
          providerPlan = sanitizeAiProviderPlan(planResult.object);
        } else {
          providerPlanErrorCode = aiProviderErrorCode(planResult?.error);
        }
      }

      await writeAuditEvent(backendAuditDriver, aiAssistAuditEvent({
        draft,
        context,
        provider: result.provider || config.provider || "",
        model: result.model || config.model || "",
        providerStatus: "ok",
        workflow
      }, auth.user, { at: currentTime }));

      return sendJson(res, 200, {
        ok: true,
        draft,
        actions,
        assistant: {
          provider: result.provider,
          model: result.model,
          text: cleanAssistantText(result.text, 4_000)
        },
        ...(providerPlan ? { providerPlan } : {}),
        ...(providerPlanErrorCode ? { providerPlanErrorCode } : {})
      });
    } catch (error) {
      if (error?.message === "payload_too_large") return sendJson(res, 413, { error: "payload_too_large" });
      if (error?.message === "invalid_json") return sendJson(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "ai_assist_error", route: "/api/ai/assist" });
    }
  };
}

export default createAiAssistHandler();
