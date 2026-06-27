import { describe, expect, it, vi } from "vitest";
import { createUpstashKvDriver, createUpstashKvDriverFromEnv } from "../api/kv/upstashDriver.js";

function ok(result) {
  return {
    ok: true,
    async text() {
      return JSON.stringify({ result });
    }
  };
}

describe("upstash KV driver", () => {
  it("is disabled until both url and token are configured", () => {
    expect(createUpstashKvDriver({ url: "", token: "token" })).toBeNull();
    expect(createUpstashKvDriver({ url: "https://redis.example", token: "" })).toBeNull();
  });

  it("maps the app KV contract to Upstash Redis REST commands", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok("ticket-json"))
      .mockResolvedValueOnce(ok("OK"))
      .mockResolvedValueOnce(ok(1))
      .mockResolvedValueOnce(ok(["0", ["shared:ticket:1"]]));
    const driver = createUpstashKvDriver({
      url: "https://redis.example/",
      token: "secret",
      fetchImpl
    });

    await expect(driver.get("ticket:1", true)).resolves.toBe("ticket-json");
    await expect(driver.set("ticket:1", "ticket-json", true)).resolves.toBeUndefined();
    await expect(driver.delete("ticket:1", true)).resolves.toBeUndefined();
    await expect(driver.list("ticket:", true)).resolves.toEqual(["ticket:1"]);

    expect(fetchImpl.mock.calls.map(([url, options]) => [url, JSON.parse(options.body)])).toEqual([
      ["https://redis.example", ["GET", "shared:ticket:1"]],
      ["https://redis.example", ["SET", "shared:ticket:1", "ticket-json"]],
      ["https://redis.example", ["DEL", "shared:ticket:1"]],
      ["https://redis.example", ["SCAN", "0", "MATCH", "shared:ticket:*", "COUNT", "100"]]
    ]);
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe("Bearer secret");
  });

  it("supports Vercel KV and Upstash env variable names", () => {
    expect(createUpstashKvDriverFromEnv({
      KV_REST_API_URL: "https://redis.example",
      KV_REST_API_TOKEN: "secret"
    }, vi.fn())).not.toBeNull();
    expect(createUpstashKvDriverFromEnv({
      UPSTASH_REDIS_REST_URL: "https://redis.example",
      UPSTASH_REDIS_REST_TOKEN: "secret"
    }, vi.fn())).not.toBeNull();
  });
});
