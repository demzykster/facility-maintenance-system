import { describe, expect, it, vi } from "vitest";
import { createApiFleetProvider } from "../src/apiFleetAdapter.js";

const okResponse = (body = {}) => ({
  ok: true,
  text: () => Promise.resolve(JSON.stringify(body))
});

const errorResponse = (status, body = {}) => ({
  ok: false,
  status,
  text: () => Promise.resolve(JSON.stringify(body))
});

describe("api fleet adapter", () => {
  it("reads normalized fleet units through the production bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true, units: [{ id: "F-1" }] }));
    const provider = createApiFleetProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.list()).resolves.toEqual({ ok: true, units: [{ id: "F-1" }] });
    await expect(provider.get("F-1")).resolves.toEqual({ ok: true, units: [{ id: "F-1" }] });

    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      "https://cmms.example/api/fleet",
      "https://cmms.example/api/fleet?id=F-1"
    ]);
  });

  it("posts fleet units to the normalized fleet API with the production bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true, unit: { id: "F-1" } }));
    const provider = createApiFleetProvider({
      baseUrl: "https://cmms.example/api///",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.upsert({ id: "F-1", code: "111" })).resolves.toEqual({ ok: true, unit: { id: "F-1" } });

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/fleet", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      },
      body: JSON.stringify({ unit: { id: "F-1", code: "111" } })
    });
  });

  it("throws the API error without hiding the backend reason", async () => {
    const provider = createApiFleetProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl: vi.fn().mockResolvedValue(errorResponse(403, { error: "permission_denied" }))
    });

    await expect(provider.upsert({ id: "F-1" })).rejects.toThrow("permission_denied");
  });

  it("deletes normalized fleet units through the same API route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true }));
    const provider = createApiFleetProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.delete("F-1")).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/fleet?id=F-1", {
      method: "DELETE",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      }
    });
  });

  it("stays disabled when no API base URL is configured", () => {
    expect(createApiFleetProvider({ baseUrl: "" })).toBeNull();
  });
});
