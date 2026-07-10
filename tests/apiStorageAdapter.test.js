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
      .mockResolvedValueOnce(ok({ ok: true, count: 1 }))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok({ keys: ["ticket:1"] }))
      .mockResolvedValueOnce(ok({ records: [{ key: "ticket:1", value: "ticket-json" }] }))
      .mockResolvedValueOnce(ok({ collections: { "ticket:": [{ key: "ticket:1", value: "ticket-json" }] } }));
    const provider = createApiStorageProvider({ baseUrl: "https://cmms.example/api/", fetchImpl });

    await expect(provider.get("ticket:1", true)).resolves.toEqual({ value: "ticket-json" });
    await expect(provider.set("ticket:1", "ticket-json", true)).resolves.toBe(true);
    await expect(provider.setMany([{ key: "ticket:2", value: "ticket-json-2" }], true)).resolves.toBe(true);
    await expect(provider.delete("ticket:1", true)).resolves.toBe(true);
    await expect(provider.list("ticket:", true)).resolves.toEqual({ keys: ["ticket:1"] });
    await expect(provider.listValues("ticket:", true)).resolves.toEqual({ records: [{ key: "ticket:1", value: "ticket-json" }] });
    await expect(provider.listManyValues(["ticket:"], true)).resolves.toEqual({ collections: { "ticket:": [{ key: "ticket:1", value: "ticket-json" }] } });

    expect(fetchImpl.mock.calls.map(([url, options]) => [url, options.method || "GET"])).toEqual([
      ["https://cmms.example/api/kv/ticket%3A1?shared=1", "GET"],
      ["https://cmms.example/api/kv/ticket%3A1", "PUT"],
      ["https://cmms.example/api/kv", "POST"],
      ["https://cmms.example/api/kv/ticket%3A1?shared=1", "DELETE"],
      ["https://cmms.example/api/kv?prefix=ticket%3A&shared=1", "GET"],
      ["https://cmms.example/api/kv?prefix=ticket%3A&shared=1&includeValues=1", "GET"],
      ["https://cmms.example/api/kv?prefixes=ticket%3A&shared=1&includeValues=1", "GET"]
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ value: "ticket-json", shared: true });
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toEqual({
      records: [{ key: "ticket:2", value: "ticket-json-2" }],
      shared: true,
      atomic: false
    });
  });

  it("can request an atomic batch write", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(ok({ ok: true, count: 2, atomic: true }));
    const provider = createApiStorageProvider({ baseUrl: "https://cmms.example/api", fetchImpl });

    await expect(provider.setMany([{ key: "fleet:1", value: "{}" }], true, { atomic: true })).resolves.toBe(true);

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      records: [{ key: "fleet:1", value: "{}" }],
      shared: true,
      atomic: true
    });
  });

  it("routes shared config:v1 operations through the settings config API", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok({ ok: true, value: "{\"companyName\":\"CDSL\"}" }))
      .mockResolvedValueOnce(ok({ ok: true }))
      .mockResolvedValueOnce(ok({ ok: true }))
      .mockResolvedValueOnce(ok({ ok: true }))
      .mockResolvedValueOnce(ok({ ok: true }));
    const provider = createApiStorageProvider({ baseUrl: "https://cmms.example/api", fetchImpl });

    await expect(provider.get("config:v1", true)).resolves.toEqual({ ok: true, value: "{\"companyName\":\"CDSL\"}" });
    await expect(provider.set("config:v1", "{\"companyName\":\"CDSL\"}", true)).resolves.toBe(true);
    await expect(provider.setMany([
      { key: "config:v1", value: "{\"companyName\":\"CDSL\"}" },
      { key: "ticket:1", value: "{}" }
    ], true)).resolves.toBe(true);
    await expect(provider.delete("config:v1", true)).resolves.toBe(true);

    expect(fetchImpl.mock.calls.map(([url, options]) => [url, options.method || "GET"])).toEqual([
      ["https://cmms.example/api/settings/config", "GET"],
      ["https://cmms.example/api/settings/config", "PUT"],
      ["https://cmms.example/api/settings/config", "PUT"],
      ["https://cmms.example/api/kv", "POST"],
      ["https://cmms.example/api/settings/config", "DELETE"]
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[3][1].body)).toEqual({
      records: [{ key: "ticket:1", value: "{}" }],
      shared: true,
      atomic: false
    });
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
