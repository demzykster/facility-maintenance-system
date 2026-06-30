import { buildAiIntakeDraft } from "../../src/aiIntakeModel.js";
import { sendJson, sendServerError } from "../httpErrors.js";

const MAX_BODY_BYTES = 64_000;
const MAX_TEXT_CHARS = 2_000;

const getHeader = (headers = {}, name) => {
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (direct) return Array.isArray(direct) ? direct[0] : direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  if (!match) return "";
  return Array.isArray(match[1]) ? match[1][0] : match[1];
};

const cleanText = (value, limit = MAX_TEXT_CHARS) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const safeSource = (value) => {
  const source = String(value || "ui").trim();
  return ["ui", "public_report", "worker", "cleaner", "mobile", "test"].includes(source) ? source : "ui";
};

const safeLanguage = (value) => {
  const language = String(value || "he").trim().toLowerCase().replace("_", "-").split("-")[0];
  return ["he", "en", "ru", "ar", "hi", "ti"].includes(language) ? language : "he";
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
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

export function normalizeAiIntakeRequest(body = {}, req = {}) {
  const rawText = cleanText(body.rawText || body.text || body.description);
  if (!rawText) return { ok: false, status: 400, error: "text_required" };
  const actor = body.actor && typeof body.actor === "object"
    ? {
        type: cleanText(body.actor.type || "user", 40),
        id: cleanText(body.actor.id, 80),
        role: cleanText(body.actor.role, 40),
        name: cleanText(body.actor.name, 120)
      }
    : {
        type: getHeader(req.headers, "authorization") ? "authenticated" : "anonymous"
      };
  return {
    ok: true,
    input: {
      rawText,
      module: body.module,
      severity: body.severity,
      source: safeSource(body.source),
      language: safeLanguage(body.language),
      actor
    }
  };
}

export function createAiIntakeHandler({ now = () => Date.now() } = {}) {
  return async function aiIntakeHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "POST") {
      res.setHeader("allow", "POST");
      return sendJson(res, 405, { error: "method_not_allowed" });
    }

    try {
      const body = await readBody(req);
      const normalized = normalizeAiIntakeRequest(body, req);
      if (!normalized.ok) return sendJson(res, normalized.status, { error: normalized.error });
      const draft = buildAiIntakeDraft(normalized.input, now());
      return sendJson(res, 200, { ok: true, draft });
    } catch (error) {
      if (error?.message === "payload_too_large") return sendJson(res, 413, { error: "payload_too_large" });
      if (error?.message === "invalid_json") return sendJson(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "ai_intake_error", route: "/api/ai/intake" });
    }
  };
}

export default createAiIntakeHandler();
