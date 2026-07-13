import { publicAiServerStatusFromEnv } from "../../src/aiProviderModel.js";
import { canFull } from "../../src/permissionModel.js";
import { sendJson, sendServerError } from "../httpErrors.js";
import { authorizeAiRequest } from "./auth.js";
import { callAiProvider } from "./providerClient.js";

const firstQueryValue = (value) => Array.isArray(value) ? value[0] : value;

function queryValue(req, key) {
  const fromQuery = firstQueryValue(req?.query?.[key]);
  if (fromQuery !== undefined) return fromQuery;
  try {
    return new URL(req?.url || "", "http://cmms.local").searchParams.get(key);
  } catch {
    return "";
  }
}

function wantsConnectionCheck(req) {
  return ["1", "true", "live"].includes(String(queryValue(req, "check") || "").trim().toLowerCase());
}

export function createAiStatusHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  sessionClient = null,
  pinSessionClient = null,
  providerCall = callAiProvider,
  now = () => Date.now()
} = {}) {
  return async function aiStatusHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "GET") {
      res.setHeader("allow", "GET");
      return sendJson(res, 405, { error: "method_not_allowed" });
    }

    const auth = await authorizeAiRequest(req, env, fetchImpl, sessionClient, pinSessionClient);
    if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });

    try {
      const ai = publicAiServerStatusFromEnv(env);
      if (wantsConnectionCheck(req)) {
        if (!canFull(auth.user, "settings")) return sendJson(res, 403, { error: "settings_full_required" });
        ai.providerCheck = {
          attempted: true,
          ok: false,
          provider: ai.provider,
          model: ai.model,
          checkedAt: now()
        };
        if (!ai.serverReady) {
          ai.providerCheck.error = ai.errors[0] || "ai_server_not_ready";
        } else {
          const result = await providerCall({
            config: {
              mode: ai.mode,
              provider: ai.provider,
              model: ai.model,
              anthropicApiKey: env.ANTHROPIC_API_KEY,
              openaiApiKey: env.OPENAI_API_KEY
            },
            system: "You are a CMMS AI connection check. Reply with exactly: OK",
            prompt: "Reply with OK only.",
            fetchImpl,
            maxTokens: 8
          });
          ai.providerCheck.ok = !!result?.ok;
          if (!result?.ok) ai.providerCheck.error = result?.error || "ai_provider_check_failed";
        }
      }
      return sendJson(res, 200, {
        ok: true,
        ai
      });
    } catch (error) {
      return sendServerError(req, res, error, { code: "ai_status_error", route: "/api/ai/status" });
    }
  };
}

export default createAiStatusHandler();
