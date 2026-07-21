import { describe, expect, it } from "vitest";
import { buildPublicHealthResponse, HEALTH_CHECK, healthStatusForChecks } from "../src/healthCheckModel.js";

describe("health check model", () => {
  it("marks all-ok checks as healthy", () => {
    const checks = {
      api: HEALTH_CHECK.ok,
      configuration: HEALTH_CHECK.ok,
      database: HEALTH_CHECK.ok,
      storage: HEALTH_CHECK.ok
    };

    expect(healthStatusForChecks(checks)).toBe("ok");
    expect(buildPublicHealthResponse({ checks, version: "abcdef123", timestamp: "2026-07-22T00:00:00.000Z" })).toEqual({
      status: "ok",
      version: "abcdef123",
      checks,
      timestamp: "2026-07-22T00:00:00.000Z"
    });
  });

  it("returns a stable degraded schema with request id", () => {
    const response = buildPublicHealthResponse({
      checks: { api: "ok", configuration: "ok", database: "failed", storage: "skipped" },
      version: "local",
      timestamp: "2026-07-22T00:00:00.000Z",
      requestId: "req-health"
    });

    expect(response).toEqual({
      status: "degraded",
      version: "local",
      checks: {
        api: "ok",
        configuration: "ok",
        database: "failed",
        storage: "skipped"
      },
      timestamp: "2026-07-22T00:00:00.000Z",
      requestId: "req-health"
    });
  });

  it("normalizes unknown check values to failed", () => {
    const response = buildPublicHealthResponse({ checks: { api: "ok", configuration: "weird" } });

    expect(response.status).toBe("degraded");
    expect(response.checks.configuration).toBe("failed");
    expect(response.checks.database).toBe("failed");
  });
});
