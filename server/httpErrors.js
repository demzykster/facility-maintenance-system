import { randomUUID } from "node:crypto";

const headerValue = (headers = {}, name) => {
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (direct) return Array.isArray(direct) ? direct[0] : direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  if (!match) return "";
  return Array.isArray(match[1]) ? match[1][0] : match[1];
};

const requestIdFor = (req = {}) => {
  const existing = String(
    headerValue(req.headers, "x-cmms-request-id")
    || headerValue(req.headers, "x-request-id")
    || headerValue(req.headers, "x-vercel-id")
    || ""
  ).trim();
  return existing || randomUUID();
};

const redactSensitiveText = (value) => String(value || "")
  .replace(/\b(bearer\s+)[^\s,;]+/gi, "$1[redacted]")
  .replace(/\b(authorization|apikey|api[_-]?key|service[_-]?role|secret|token|password)([\"':=\s-]+)[^\s,;]+/gi, "$1$2[redacted]")
  .replace(/\b[A-Za-z0-9_-]{36,}\b/g, "[redacted-token]");

const safeMessage = (error) => {
  const name = String(error?.name || "Error").slice(0, 80);
  const message = redactSensitiveText(error?.message || "unknown_error").slice(0, 240);
  return { name, message };
};

export const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

export const sendServerError = (req, res, error, {
  code = "server_error",
  route = "api",
  extra = {},
  logger = console.error
} = {}) => {
  const requestId = requestIdFor(req);
  const method = String(req?.method || "").toUpperCase();
  const details = safeMessage(error);
  logger(JSON.stringify({
    level: "error",
    source: "cmms-api",
    requestId,
    route,
    method,
    code,
    ...details
  }));
  res.setHeader("x-cmms-request-id", requestId);
  return sendJson(res, 500, { error: code, requestId, ...extra });
};
