import { describe, expect, it, vi } from "vitest";
import { createAiActionHandler } from "../api/ai/[action].js";

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

describe("AI action route", () => {
  it("dispatches existing AI URLs through one Vercel route file", async () => {
    const assist = vi.fn((req, res) => {
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, action: "assist" }));
    });
    const status = vi.fn((req, res) => {
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, action: "status" }));
    });
    const handler = createAiActionHandler({ assist, status });

    const assistRes = createRes();
    await handler({ query: { action: "assist" } }, assistRes);
    expect(assistRes.statusCode).toBe(200);
    expect(assistRes.json()).toEqual({ ok: true, action: "assist" });
    expect(assist).toHaveBeenCalledTimes(1);

    const statusRes = createRes();
    await handler({ query: { action: ["status"] } }, statusRes);
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json()).toEqual({ ok: true, action: "status" });
    expect(status).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown AI actions", async () => {
    const handler = createAiActionHandler({});
    const res = createRes();

    await handler({ query: { action: "unknown" } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "ai_action_not_found" });
  });
});
