import { publicAiServerStatusFromEnv } from "../../src/aiProviderModel.js";
import { sendJson, sendServerError } from "../httpErrors.js";
import { authorizeAiRequest } from "./auth.js";

export function createAiStatusHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  sessionClient = null,
  pinSessionClient = null
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
      return sendJson(res, 200, {
        ok: true,
        ai: publicAiServerStatusFromEnv(env)
      });
    } catch (error) {
      return sendServerError(req, res, error, { code: "ai_status_error", route: "/api/ai/status" });
    }
  };
}

export default createAiStatusHandler();
