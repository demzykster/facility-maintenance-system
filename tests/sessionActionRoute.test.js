import { describe, expect, it } from "vitest";
import { createSessionActionHandler } from "../api/session/[action].js";

function createJsonResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
    }
  };
}

describe("session action API route", () => {
  it("dispatches existing session URLs to their handlers", async () => {
    const calls = [];
    const handler = createSessionActionHandler({
      login: async (req, res) => calls.push(["login", req, res]),
      me: async (req, res) => calls.push(["me", req, res]),
      "change-password": async (req, res) => calls.push(["change-password", req, res])
    });
    const req = { query: { action: "login" } };
    const res = createJsonResponse();

    await handler(req, res);

    expect(calls).toEqual([["login", req, res]]);
  });

  it("handles Vercel array query values", async () => {
    const calls = [];
    const handler = createSessionActionHandler({
      me: async (req, res) => calls.push(["me", req, res])
    });
    const req = { query: { action: ["me"] } };
    const res = createJsonResponse();

    await handler(req, res);

    expect(calls).toEqual([["me", req, res]]);
  });

  it("returns a 404 for unknown session actions", async () => {
    const handler = createSessionActionHandler({
      login: async () => {
        throw new Error("login handler should not be called");
      }
    });
    const res = createJsonResponse();

    await handler({ query: { action: "unknown" } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(JSON.parse(res.body)).toEqual({ error: "session_action_not_found" });
  });
});
