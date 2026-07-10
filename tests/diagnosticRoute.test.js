import { describe, expect, it } from "vitest";
import { createDiagnosticRouteHandler } from "../api/[diagnostic].js";

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

describe("diagnostic API route", () => {
  it("dispatches the client-errors URL to the client error handler", async () => {
    const calls = [];
    const handler = createDiagnosticRouteHandler({
      "client-errors": async (req, res) => calls.push(["client-errors", req, res]),
      "system-errors": async (req, res) => calls.push(["system-errors", req, res])
    });
    const req = { query: { diagnostic: "client-errors" } };
    const res = createJsonResponse();

    await handler(req, res);

    expect(calls).toEqual([["client-errors", req, res]]);
  });

  it("dispatches the system-errors URL to the system error handler", async () => {
    const calls = [];
    const handler = createDiagnosticRouteHandler({
      "system-errors": async (req, res) => calls.push(["system-errors", req, res])
    });
    const req = { query: { diagnostic: ["system-errors"] } };
    const res = createJsonResponse();

    await handler(req, res);

    expect(calls).toEqual([["system-errors", req, res]]);
  });

  it("returns a 404 for unknown diagnostics routes", async () => {
    const handler = createDiagnosticRouteHandler({
      "client-errors": async () => {
        throw new Error("client-errors handler should not be called");
      }
    });
    const res = createJsonResponse();

    await handler({ query: { diagnostic: "other" } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(JSON.parse(res.body)).toEqual({ error: "diagnostic_route_not_found" });
  });
});
