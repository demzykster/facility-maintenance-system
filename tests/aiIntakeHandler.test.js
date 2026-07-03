import { describe, expect, it } from "vitest";
import {
  createAiIntakeHandler,
  normalizeAiIntakeRequest
} from "../server/ai/intakeHandler.js";

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
    },
    json() {
      return this.body ? JSON.parse(this.body) : null;
    }
  };
}

async function call(handler, req) {
  const res = createRes();
  await handler({ headers: {}, method: "POST", body: {}, ...req }, res);
  return res;
}

describe("AI intake handler", () => {
  it("is POST-only and never writes data", async () => {
    const handler = createAiIntakeHandler({ now: () => 100 });
    const res = await call(handler, { method: "GET" });

    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe("POST");
    expect(res.json()).toEqual({ error: "method_not_allowed" });
  });

  it("validates the narrow request before drafting", () => {
    expect(normalizeAiIntakeRequest({ text: "" })).toEqual({
      ok: false,
      status: 400,
      error: "text_required"
    });
    expect(normalizeAiIntakeRequest({
      text: "  מלגזה תקועה  ",
      language: "ru-RU",
      source: "unknown-source",
      actor: { id: "u1", role: "user", name: "Vadim" }
    })).toMatchObject({
      ok: true,
      input: {
        rawText: "מלגזה תקועה",
        language: "ru",
        source: "ui",
        actor: { id: "u1", role: "user", name: "Vadim" }
      }
    });
  });

  it("returns a read-only draft from free text", async () => {
    const handler = createAiIntakeHandler({ now: () => 123 });
    const res = await call(handler, {
      body: {
        text: "באזור טעינה יש עשן וניצוץ חשמל, עובדים ליד המקום",
        source: "mobile",
        language: "he"
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      draft: {
        createdAt: 123,
        module: "safety",
        severity: "critical",
        source: "mobile",
        allowedToWrite: false,
        writePolicy: "human_confirmation_required",
        action: "draft_safety_inspection"
      }
    });
  });

  it("handles invalid JSON without leaking internals", async () => {
    async function* body() {
      yield Buffer.from("{bad");
    }
    const handler = createAiIntakeHandler();
    const res = await createRes();
    await handler({ headers: {}, method: "POST", [Symbol.asyncIterator]: body }, res);

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid_json" });
  });
});
