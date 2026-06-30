import { describe, expect, it, vi } from "vitest";
import { createApiStorageProvider } from "../src/apiStorageAdapter.js";

function ok(body = null) {
  return {
    ok: true,
    async text() {
      return body === null ? "" : JSON.stringify(body);
    }
  };
}

describe("apiStorageAdapter", () => {
  it("returns null when no api url is configured", () => {
    expect(createApiStorageProvider({ baseUrl: "" })).toBeNull();
  });

  it("uses the storage api key-value contract", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok({ value: "ticket-json" }))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok({ keys: ["ticket:1"] }))
      .mockResolvedValueOnce(ok({ records: [{ key: "ticket:1", value: "ticket-json" }] }));
    const provider = createApiStorageProvider({ baseUrl: "https://cmms.example/api/", fetchImpl });

    await expect(provider.get("ticket:1", true)).resolves.toEqual({ value: "ticket-json" });
    await expect(provider.set("ticket:1", "ticket-json", true)).resolves.toBe(true);
    await expect(provider.delete("ticket:1", true)).resolves.toBe(true);
    await expect(provider.list("ticket:", true)).resolves.toEqual({ keys: ["ticket:1"] });
    await expect(provider.listValues("ticket:", true)).resolves.toEqual({ records: [{ key: "ticket:1", value: "ticket-json" }] });

    expect(fetchImpl.mock.calls.map(([url, options]) => [url, options.method || "GET"])).toEqual([
      ["https://cmms.example/api/kv/ticket%3A1?shared=1", "GET"],
      ["https://cmms.example/api/kv/ticket%3A1", "PUT"],
      ["https://cmms.example/api/kv/ticket%3A1?shared=1", "DELETE"],
      ["https://cmms.example/api/kv?prefix=ticket%3A&shared=1", "GET"],
      ["https://cmms.example/api/kv?prefix=ticket%3A&shared=1&includeValues=1", "GET"]
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ value: "ticket-json", shared: true });
  });

  it("adds the production access token when available", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(ok({ value: "ticket-json" }));
    const provider = createApiStorageProvider({
      baseUrl: "https://cmms.example/api",
      getAccessToken: () => "access-token",
      fetchImpl
    });

    await provider.get("ticket:1", true);

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/kv/ticket%3A1?shared=1", expect.objectContaining({
      headers: expect.objectContaining({
        authorization: "Bearer access-token"
      })
    }));
  });

  it("supports asynchronously refreshed production access tokens", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(ok({ value: "ticket-json" }));
    const provider = createApiStorageProvider({
      baseUrl: "https://cmms.example/api",
      getAccessToken: async () => "fresh-access-token",
      fetchImpl
    });

    await provider.get("ticket:1", true);

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/kv/ticket%3A1?shared=1", expect.objectContaining({
      headers: expect.objectContaining({
        authorization: "Bearer fresh-access-token"
      })
    }));
  });

  it("does not add an empty authorization header", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(ok({ value: "ticket-json" }));
    const provider = createApiStorageProvider({
      baseUrl: "https://cmms.example/api",
      getAccessToken: () => "",
      fetchImpl
    });

    await provider.get("ticket:1", true);

    expect(fetchImpl.mock.calls[0][1].headers).not.toHaveProperty("authorization");
  });

  it("throws backend errors so the app store can fall back locally", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      async text() {
        return JSON.stringify({ error: "offline" });
      }
    });
    const provider = createApiStorageProvider({ baseUrl: "https://cmms.example/api", fetchImpl });

    await expect(provider.get("ticket:1")).rejects.toThrow("offline");
  });
});
