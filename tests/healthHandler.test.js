import { describe, expect, it, vi } from "vitest";
import { createHealthHandler } from "../server/health/handler.js";

const healthyEnv = Object.freeze({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret-that-must-not-leak",
  CMMS_DATA_AUTHORITY: "normalized",
  CMMS_FILE_DRIVER: "supabase",
  CMMS_FILE_BUCKET: "private-files",
  VERCEL_GIT_COMMIT_SHA: "abcdef123456"
});

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body = "") {
      this.body = body;
    },
    json() {
      return this.body ? JSON.parse(this.body) : null;
    }
  };
}

async function callHealth({
  method = "GET",
  env = healthyEnv,
  fetchImpl = async () => ({ ok: true }),
  timeoutMs = 50,
  headers = { "x-request-id": "req-health" }
} = {}) {
  const handler = createHealthHandler({
    env,
    fetchImpl,
    timeoutMs,
    now: () => "2026-07-22T00:00:00.000Z"
  });
  const res = createRes();
  await handler({ method, headers }, res);
  return res;
}

describe("health API handler", () => {
  it("returns a compact healthy response", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const res = await callHealth({ fetchImpl });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(res.json()).toEqual({
      status: "ok",
      version: "abcdef1",
      checks: {
        api: "ok",
        configuration: "ok",
        database: "ok",
        storage: "ok"
      },
      timestamp: "2026-07-22T00:00:00.000Z"
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1].method).toBe("HEAD");
  });

  it("maps database failure to 503 without leaking raw exception details", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("service-role-secret stack trace detail");
    });
    const res = await callHealth({ fetchImpl });
    const text = res.body;

    expect(res.statusCode).toBe(503);
    expect(res.headers["x-cmms-request-id"]).toBe("req-health");
    expect(res.json()).toMatchObject({
      status: "degraded",
      version: "abcdef1",
      checks: {
        api: "ok",
        configuration: "ok",
        database: "failed",
        storage: "ok"
      },
      requestId: "req-health"
    });
    expect(text).not.toContain("service-role-secret");
    expect(text).not.toContain("stack trace detail");
    expect(text).not.toContain("Error:");
  });

  it("returns degraded when required configuration is missing", async () => {
    const res = await callHealth({
      env: { ...healthyEnv, SUPABASE_SERVICE_ROLE_KEY: "" },
      fetchImpl: vi.fn(async () => {
        throw new Error("should not be useful");
      })
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      status: "degraded",
      checks: {
        api: "ok",
        configuration: "failed",
        database: "failed",
        storage: "ok"
      }
    });
    expect(res.body).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("uses no-cache headers and 405 for unsupported methods", async () => {
    const res = await callHealth({ method: "POST" });

    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe("GET, HEAD");
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.json()).toEqual({ error: "method_not_allowed" });
  });

  it("supports HEAD without a JSON body", async () => {
    const res = await callHealth({ method: "HEAD" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("");
  });

  it("times out dependency checks and keeps the response schema stable", async () => {
    const res = await callHealth({
      timeoutMs: 5,
      fetchImpl: vi.fn(() => new Promise(() => {}))
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      status: "degraded",
      checks: {
        api: "ok",
        configuration: "ok",
        database: "failed",
        storage: "ok"
      },
      requestId: "req-health"
    });
  });

  it("does not execute write operations for the dependency probe", async () => {
    const methods = [];
    await callHealth({
      fetchImpl: vi.fn(async (_url, options) => {
        methods.push(options.method);
        return { ok: true };
      })
    });

    expect(methods).toEqual(["HEAD"]);
    expect(methods).not.toContain("POST");
    expect(methods).not.toContain("PUT");
    expect(methods).not.toContain("PATCH");
    expect(methods).not.toContain("DELETE");
  });
});
