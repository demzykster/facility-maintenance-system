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

const noContentResponse = () => ({
  ok: true,
  status: 204,
  text: () => Promise.resolve("")
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

  it("posts explicit create and update operations without overloading upsert semantics", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(okResponse({ ok: true, action: "created", ticket: { id: "T-1" } }))
      .mockResolvedValueOnce(okResponse({ ok: true, action: "updated", ticket: { id: "T-1" } }));
    const provider = createApiTicketProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.create({ id: "T-1", subject: "Leak" }, { idempotencyKey: "idem-1" }))
      .resolves.toMatchObject({ action: "created" });
    await expect(provider.update({ id: "T-1", subject: "Fixed" }))
      .resolves.toMatchObject({ action: "updated" });

    expect(fetchImpl.mock.calls[0]).toEqual(["https://cmms.example/api/tickets", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1",
        "idempotency-key": "idem-1"
      },
      body: JSON.stringify({
        ticket: { id: "T-1", subject: "Leak" },
        operation: "create",
        idempotencyKey: "idem-1"
      })
    }]);
    expect(fetchImpl.mock.calls[1]).toEqual(["https://cmms.example/api/tickets", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      },
      body: JSON.stringify({
        ticket: { id: "T-1", subject: "Fixed" },
        operation: "update"
      })
    }]);
  });

  it("posts priority updates through the dedicated ticket operation", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true, action: "priority_updated", ticket: { id: "T-1", priority: "high" } }));
    const provider = createApiTicketProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.updatePriority("T-1", "high")).resolves.toMatchObject({ action: "priority_updated" });

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/tickets", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      },
      body: JSON.stringify({
        ticket: { id: "T-1", priority: "high" },
        operation: "priority"
      })
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

  it("accepts a 204 no-content delete response", async () => {
    const provider = createApiTicketProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl: vi.fn().mockResolvedValue(noContentResponse())
    });

    await expect(provider.delete("T-204")).resolves.toBe(true);
  });

  it("surfaces a real delete error", async () => {
    const provider = createApiTicketProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl: vi.fn().mockResolvedValue(errorResponse(500, { error: "tickets_api_error" }))
    });

    await expect(provider.delete("T-500")).rejects.toThrow("tickets_api_error");
  });

  it("stays disabled when no API base URL is configured", () => {
    expect(createApiTicketProvider({ baseUrl: "" })).toBeNull();
  });
});
