import { describe, expect, it, vi } from "vitest";
import { createApiCleaningRoundsProvider } from "../src/apiCleaningRoundsAdapter.js";

const okResponse = (body = {}) => ({
  ok: true,
  text: () => Promise.resolve(JSON.stringify(body))
});

const errorResponse = (status, body = {}) => ({
  ok: false,
  status,
  text: () => Promise.resolve(JSON.stringify(body))
});

describe("api cleaning rounds adapter", () => {
  it("reads normalized cleaning rounds through the production bearer token", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(okResponse({ ok: true, rounds: [{ id: "round-1" }] }))
      .mockResolvedValueOnce(okResponse({ ok: true, round: { id: "round-1" } }));
    const provider = createApiCleaningRoundsProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.list()).resolves.toEqual({ ok: true, rounds: [{ id: "round-1" }] });
    await expect(provider.get("round-1")).resolves.toEqual({ ok: true, round: { id: "round-1" } });

    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      "https://cmms.example/api/cleaning/rounds",
      "https://cmms.example/api/cleaning/rounds?id=round-1"
    ]);
  });

  it("posts cleaning rounds to the normalized API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true, round: { id: "round-1" } }));
    const provider = createApiCleaningRoundsProvider({
      baseUrl: "https://cmms.example/api///",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.upsert({ id: "round-1", zoneId: "zone-1" })).resolves.toEqual({ ok: true, round: { id: "round-1" } });

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/cleaning/rounds", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      },
      body: JSON.stringify({ round: { id: "round-1", zoneId: "zone-1" } })
    });
  });

  it("throws the API error without hiding the backend reason", async () => {
    const provider = createApiCleaningRoundsProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl: vi.fn().mockResolvedValue(errorResponse(403, { error: "permission_denied" }))
    });

    await expect(provider.upsert({ id: "round-1" })).rejects.toThrow("permission_denied");
  });

  it("deletes normalized cleaning rounds through the same API route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true }));
    const provider = createApiCleaningRoundsProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.delete("round-1")).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/cleaning/rounds?id=round-1", {
      method: "DELETE",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      }
    });
  });

  it("stays disabled when no API base URL is configured", () => {
    expect(createApiCleaningRoundsProvider({ baseUrl: "" })).toBeNull();
  });
});
