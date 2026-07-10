import { describe, expect, it, vi } from "vitest";
import { createApiPpeProvider } from "../src/apiPpeAdapter.js";

const response = (body = {}, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body)
});

describe("API PPE adapter", () => {
  it("lists PPE resources through the shared route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ ok: true, items: [{ id: "item-1" }] }));
    const provider = createApiPpeProvider({ baseUrl: "/api", fetchImpl, getAccessToken: () => "token" });

    await expect(provider.items.list()).resolves.toEqual({ ok: true, items: [{ id: "item-1" }] });
    expect(fetchImpl).toHaveBeenCalledWith("/api/ppe?resource=items", expect.objectContaining({
      method: "GET",
      credentials: "include",
      headers: expect.objectContaining({ authorization: "Bearer token" })
    }));
  });

  it("upserts PPE requests with resource payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ ok: true, request: { id: "req-1" } }));
    const provider = createApiPpeProvider({ baseUrl: "/api", fetchImpl });

    await provider.requests.upsert({ id: "req-1" });

    expect(fetchImpl).toHaveBeenCalledWith("/api/ppe", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ resource: "requests", request: { id: "req-1" } })
    }));
  });

  it("deletes PPE movements through the shared route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ ok: true }));
    const provider = createApiPpeProvider({ baseUrl: "/api", fetchImpl });

    await expect(provider.movements.delete("move-1")).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith("/api/ppe?resource=movements&id=move-1", expect.objectContaining({ method: "DELETE" }));
  });
});
