import { buildAiIntakeDraft } from "../../src/aiIntakeModel.js";
import { AI_MODES, aiServerConfigFromEnv } from "../../src/aiProviderModel.js";
import { sendJson, sendServerError } from "../httpErrors.js";
import { authorizeAiRequest } from "./auth.js";
import { callAiProvider } from "./providerClient.js";

const MAX_BODY_BYTES = 64_000;
const MAX_TEXT_CHARS = 2_000;
const DEFAULT_RATE_LIMIT_MS = 10_000;
const AI_ASSIST_RATE_BUCKETS = new Map();

const cleanText = (value, limit = MAX_TEXT_CHARS) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const safeLanguage = (value) => {
  const language = String(value || "he").trim().toLowerCase().replace("_", "-").split("-")[0];
  return ["he", "en", "ru", "ar", "hi", "ti"].includes(language) ? language : "he";
};

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

function providerPrompt({ draft, user }) {
  return JSON.stringify({
    contract: {
      writePolicy: "human_confirmation_required",
      allowedToWrite: false,
      expectedOutput: "short user-facing assistant text with any missing questions"
    },
    actor: {
      role: user.role || "",
      department: user.department || user.dept || "",
      departments: user.departments || user.depts || []
    },
    draft
  });
}

const SYSTEM_PROMPT = [
  "You are the server-side CMMS assistant.",
  "You must be read-only: do not claim that you created, updated, deleted, assigned, approved, or closed anything.",
  "Use the deterministic draft as the source of truth.",
  "Keep the reply concise and operational.",
  "If information is missing, ask the missing questions.",
  "Reply in the draft language when possible."
].join(" ");

export function createAiAssistHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  sessionClient = null,
  pinSessionClient = null,
  providerCall = callAiProvider,
  now = () => Date.now(),
  rateBuckets = AI_ASSIST_RATE_BUCKETS
} = {}) {
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

      const draft = buildAiIntakeDraft(normalized.input, currentTime);
      const config = aiServerConfigFromEnv(env);
      if (config.mode !== AI_MODES.server) {
        return sendJson(res, 503, { error: "ai_server_disabled", draft });
      }

      const result = await providerCall({
        config,
        system: SYSTEM_PROMPT,
        prompt: providerPrompt({ draft, user: auth.user }),
        fetchImpl,
        maxTokens: Number(env.CMMS_AI_ASSIST_MAX_TOKENS || 700) || 700
      });
      if (!result?.ok) {
        return sendJson(res, 502, {
          error: "ai_provider_failed",
          provider: config.provider || "",
          draft
        });
      }

      return sendJson(res, 200, {
        ok: true,
        draft,
        assistant: {
          provider: result.provider,
          model: result.model,
          text: cleanText(result.text, 4_000)
        }
      });
    } catch (error) {
      if (error?.message === "payload_too_large") return sendJson(res, 413, { error: "payload_too_large" });
      if (error?.message === "invalid_json") return sendJson(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "ai_assist_error", route: "/api/ai/assist" });
    }
  };
}

export default createAiAssistHandler();
