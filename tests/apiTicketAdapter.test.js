import { describe, expect, it, vi } from "vitest";
import { createApiTicketProvider } from "../src/apiTicketAdapter.js";

const okResponse = (body = {}) => ({
  ok: true,
  text: () => Promise.resolve(JSON.stringify(body))
});

const errorResponse = (status, body = {}) => ({
  ok: false,
  status,
  text: () => Promise.resolve(JSON.stringify(body))
});

describe("api ticket adapter", () => {
  it("reads normalized tickets through the production bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true, tickets: [{ id: "T-1" }] }));
    const provider = createApiTicketProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.list()).resolves.toEqual({ ok: true, tickets: [{ id: "T-1" }] });
    await expect(provider.get("T-1", { includeFiles: true })).resolves.toEqual({ ok: true, tickets: [{ id: "T-1" }] });

    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      "https://cmms.example/api/tickets",
      "https://cmms.example/api/tickets?id=T-1&includeFiles=1"
    ]);
  });

  it("posts tickets to the normalized tickets API with the production bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true, ticket: { id: "T-1" } }));
    const provider = createApiTicketProvider({
      baseUrl: "https://cmms.example/api///",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.upsert({ id: "T-1", subject: "Leak" })).resolves.toEqual({ ok: true, ticket: { id: "T-1" } });

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/tickets", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      },
      body: JSON.stringify({ ticket: { id: "T-1", subject: "Leak" } })
    });
  });

  it("throws the API error without hiding the backend reason", async () => {
    const provider = createApiTicketProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl: vi.fn().mockResolvedValue(errorResponse(403, { error: "permission_denied" }))
    });

    await expect(provider.upsert({ id: "T-1" })).rejects.toThrow("permission_denied");
  });

  it("deletes normalized tickets through the same API route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true }));
    const provider = createApiTicketProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.delete("T-1")).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/tickets?id=T-1", {
      method: "DELETE",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      }
    });
  });

  it("stays disabled when no API base URL is configured", () => {
    expect(createApiTicketProvider({ baseUrl: "" })).toBeNull();
  });
});
