import { describe, expect, it, vi } from "vitest";
import { sendServerError } from "../server/httpErrors.js";

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

describe("server HTTP errors", () => {
  it("returns a request id and redacts sensitive log messages", () => {
    const logger = vi.fn();
    const res = createRes();

    sendServerError({
      method: "POST",
      headers: { "x-request-id": "req-123" }
    }, res, new Error("service-role-secret leaked detail"), {
      code: "storage_api_error",
      route: "/api/kv",
      logger
    });

    expect(res.statusCode).toBe(500);
    expect(res.headers["x-cmms-request-id"]).toBe("req-123");
    expect(res.json()).toEqual({ error: "storage_api_error", requestId: "req-123" });
    expect(logger).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logger.mock.calls[0][0])).toMatchObject({
      level: "error",
      source: "cmms-api",
      requestId: "req-123",
      route: "/api/kv",
      method: "POST",
      code: "storage_api_error",
      message: "service-role-[redacted] leaked detail"
    });
    expect(logger.mock.calls[0][0]).not.toContain("service-role-secret");
  });
});
