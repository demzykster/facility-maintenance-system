import assistHandler from "../../server/ai/assistHandler.js";
import intakeHandler from "../../server/ai/intakeHandler.js";
import statusHandler from "../../server/ai/statusHandler.js";

const HANDLERS = Object.freeze({
  assist: assistHandler,
  intake: intakeHandler,
  status: statusHandler
});

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function createAiActionHandler(handlers = HANDLERS) {
  return async function aiActionHandler(req, res) {
    const action = String(firstQueryValue(req?.query?.action) || "").trim();
    const handler = handlers[action];
    if (handler) return handler(req, res);
    return sendJson(res, 404, { error: "ai_action_not_found" });
  };
}

export default createAiActionHandler();
