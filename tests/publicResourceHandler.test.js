import { describe, expect, it } from "vitest";
import { createPublicResourceHandler } from "../api/public/[resource].js";

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

describe("public resource API route", () => {
  it("dispatches the complaints public URL to the complaints handler", async () => {
    const calls = [];
    const handler = createPublicResourceHandler({
      complaints: async (req, res) => calls.push(["complaints", req, res]),
      zones: async (req, res) => calls.push(["zones", req, res])
    });
    const req = { query: { resource: "complaints" } };
    const res = createJsonResponse();

    await handler(req, res);

    expect(calls).toEqual([["complaints", req, res]]);
  });

  it("dispatches the zones public URL to the zones handler", async () => {
    const calls = [];
    const handler = createPublicResourceHandler({
      complaints: async (req, res) => calls.push(["complaints", req, res]),
      zones: async (req, res) => calls.push(["zones", req, res])
    });
    const req = { query: { resource: ["zones"] } };
    const res = createJsonResponse();

    await handler(req, res);

    expect(calls).toEqual([["zones", req, res]]);
  });

  it("returns a 404 for unknown public resources", async () => {
    const handler = createPublicResourceHandler({
      complaints: async () => {
        throw new Error("complaints handler should not be called");
      },
      zones: async () => {
        throw new Error("zones handler should not be called");
      }
    });
    const res = createJsonResponse();

    await handler({ query: { resource: "other" } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(JSON.parse(res.body)).toEqual({ error: "public_resource_not_found" });
  });
});
