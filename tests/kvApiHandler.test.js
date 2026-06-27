import { describe, expect, it, vi } from "vitest";
import { createKvApiHandler } from "../api/kv/handler.js";

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
  await handler({ headers: {}, query: {}, method: "GET", ...req }, res);
  return res;
}

describe("kv API handler", () => {
  it("does not expose storage without explicit auth configuration", async () => {
    const handler = createKvApiHandler({ env: {} });

    const res = await call(handler, { query: { key: "ticket:1" } });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "storage_auth_not_configured" });
  });

  it("does not claim storage works before a backend driver is configured", async () => {
    const handler = createKvApiHandler({ env: { CMMS_KV_BEARER_TOKEN: "secret" } });

    const res = await call(handler, {
      headers: { authorization: "Bearer secret" },
      query: { key: "ticket:1" }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "storage_backend_not_configured" });
  });

  it("serves get/set/delete/list through the configured backend driver", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue("ticket-json"),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue(["ticket:1"])
    };
    const handler = createKvApiHandler({ driver, env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" } });

    expect((await call(handler, { query: { key: "ticket:1", shared: "1" } })).json()).toEqual({ value: "ticket-json" });
    expect((await call(handler, { method: "PUT", query: { key: "ticket:1" }, body: { value: "ticket-json", shared: true } })).json()).toEqual({ ok: true });
    expect((await call(handler, { method: "DELETE", query: { key: "ticket:1", shared: "1" } })).json()).toEqual({ ok: true });
    expect((await call(handler, { query: { prefix: "ticket:", shared: "1" } })).json()).toEqual({ keys: ["ticket:1"] });

    expect(driver.get).toHaveBeenCalledWith("ticket:1", true);
    expect(driver.set).toHaveBeenCalledWith("ticket:1", "ticket-json", true);
    expect(driver.delete).toHaveBeenCalledWith("ticket:1", true);
    expect(driver.list).toHaveBeenCalledWith("ticket:", true);
  });

  it("wires the upstash driver from server env after auth passes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({ result: "ticket-json" });
      }
    });
    const handler = createKvApiHandler({
      env: {
        CMMS_KV_DRIVER: "upstash",
        CMMS_KV_BEARER_TOKEN: "secret",
        KV_REST_API_URL: "https://redis.example",
        KV_REST_API_TOKEN: "redis-secret"
      },
      fetchImpl
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer secret" },
      query: { key: "ticket:1", shared: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ value: "ticket-json" });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(["GET", "shared:ticket:1"]);
  });
});
