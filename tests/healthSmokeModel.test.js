import { describe, expect, it } from "vitest";
import { healthEndpointUrl, parseHealthSmokeArgs, validateHealthPayload } from "../src/healthSmokeModel.js";

describe("health smoke model", () => {
  it("requires an explicit URL and appends the health path", () => {
    expect(parseHealthSmokeArgs([], {}).baseUrl).toBe("");
    expect(healthEndpointUrl("http://127.0.0.1:4173")).toBe("http://127.0.0.1:4173/api/health");
  });

  it("accepts explicit URL and timeout inputs", () => {
    expect(parseHealthSmokeArgs(["--url", "http://localhost:3000", "--timeout=25"], {})).toEqual({
      baseUrl: "http://localhost:3000",
      timeoutMs: 25
    });
    expect(healthEndpointUrl("http://localhost:3000/api/health")).toBe("http://localhost:3000/api/health");
  });

  it("validates a successful payload", () => {
    expect(validateHealthPayload({
      status: "ok",
      version: "abc1234",
      checks: { api: "ok", configuration: "ok", database: "ok", storage: "ok" },
      timestamp: "2026-07-22T00:00:00.000Z"
    })).toEqual({ ok: true, status: "ok", version: "abc1234" });
  });

  it("rejects degraded and malformed payloads", () => {
    expect(validateHealthPayload({
      status: "degraded",
      version: "abc1234",
      checks: { api: "ok", database: "failed" },
      timestamp: "2026-07-22T00:00:00.000Z"
    })).toEqual({ ok: false, error: "health_degraded" });
    expect(validateHealthPayload({ status: "ok", checks: {}, timestamp: "not-a-date" })).toEqual({
      ok: false,
      error: "invalid_health_timestamp"
    });
  });
});
