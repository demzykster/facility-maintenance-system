import { describe, expect, it, vi } from "vitest";
import { createApiCleaningZonesProvider } from "../src/apiCleaningZonesAdapter.js";

const okResponse = (body = {}) => ({
  ok: true,
  text: () => Promise.resolve(JSON.stringify(body))
});

const errorResponse = (status, body = {}) => ({
  ok: false,
  status,
  text: () => Promise.resolve(JSON.stringify(body))
});

describe("api cleaning zones adapter", () => {
  it("reads normalized cleaning zones through the production bearer token", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(okResponse({ ok: true, zones: [{ id: "zone-1" }] }))
      .mockResolvedValueOnce(okResponse({ ok: true, zone: { id: "zone-1" } }));
    const provider = createApiCleaningZonesProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.list()).resolves.toEqual({ ok: true, zones: [{ id: "zone-1" }] });
    await expect(provider.get("zone-1")).resolves.toEqual({ ok: true, zone: { id: "zone-1" } });

    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      "https://cmms.example/api/cleaning/records?resource=zones",
      "https://cmms.example/api/cleaning/records?resource=zones&id=zone-1"
    ]);
  });

  it("posts cleaning zones to the normalized API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true, zone: { id: "zone-1" } }));
    const provider = createApiCleaningZonesProvider({
      baseUrl: "https://cmms.example/api///",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.upsert({ id: "zone-1", name: "Lobby" })).resolves.toEqual({ ok: true, zone: { id: "zone-1" } });

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/cleaning/records", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      },
      body: JSON.stringify({ resource: "zones", zone: { id: "zone-1", name: "Lobby" } })
    });
  });

  it("throws the API error without hiding the backend reason", async () => {
    const provider = createApiCleaningZonesProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl: vi.fn().mockResolvedValue(errorResponse(403, { error: "permission_denied" }))
    });

    await expect(provider.upsert({ id: "zone-1" })).rejects.toThrow("permission_denied");
  });

  it("deletes normalized cleaning zones through the same API route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true }));
    const provider = createApiCleaningZonesProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.delete("zone-1")).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/cleaning/records?resource=zones&id=zone-1", {
      method: "DELETE",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      }
    });
  });

  it("stays disabled when no API base URL is configured", () => {
    expect(createApiCleaningZonesProvider({ baseUrl: "" })).toBeNull();
  });
});
