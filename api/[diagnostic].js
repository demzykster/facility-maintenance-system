import clientErrorsHandler from "../server/clientErrors/handler.js";
import systemErrorsHandler from "../server/systemErrors/handler.js";

const HANDLERS = Object.freeze({
  "client-errors": clientErrorsHandler,
  "system-errors": systemErrorsHandler
});

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function createDiagnosticRouteHandler(handlers = HANDLERS) {
  return async function diagnosticRouteHandler(req, res) {
    const diagnostic = String(firstQueryValue(req?.query?.diagnostic) || "").trim();
    const handler = handlers[diagnostic];
    if (handler) return handler(req, res);
    return sendJson(res, 404, { error: "diagnostic_route_not_found" });
  };
}

export default createDiagnosticRouteHandler();
