import { describe, expect, it, vi } from "vitest";
import { createApiPresenceProvider } from "../src/apiPresenceAdapter.js";

const response = (body = {}, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body)
});

describe("API presence adapter", () => {
  it("lists presence records through the normalized route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ ok: true, presence: [{ id: "user-1" }] }));
    const provider = createApiPresenceProvider({ baseUrl: "/api", fetchImpl, getAccessToken: () => "token" });

    await expect(provider.list()).resolves.toEqual({ ok: true, presence: [{ id: "user-1" }] });
    expect(fetchImpl).toHaveBeenCalledWith("/api/presence", expect.objectContaining({
      method: "GET",
      credentials: "include",
      headers: expect.objectContaining({ authorization: "Bearer token" })
    }));
  });

  it("upserts presence records", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ ok: true, presence: { id: "user-1" } }));
    const provider = createApiPresenceProvider({ baseUrl: "/api", fetchImpl });

    await provider.upsert({ id: "user-1", lastSeen: 123 });

    expect(fetchImpl).toHaveBeenCalledWith("/api/presence", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ presence: { id: "user-1", lastSeen: 123 } })
    }));
  });

  it("deletes presence records", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ ok: true }));
    const provider = createApiPresenceProvider({ baseUrl: "/api", fetchImpl });

    await expect(provider.delete("user-1")).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith("/api/presence?id=user-1", expect.objectContaining({ method: "DELETE" }));
  });
});
