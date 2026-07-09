import { describe, expect, it, vi } from "vitest";
import { createApiPmProvider } from "../src/apiPmAdapter.js";

const okResponse = (body = {}) => ({
  ok: true,
  text: () => Promise.resolve(JSON.stringify(body))
});

const errorResponse = (status, body = {}) => ({
  ok: false,
  status,
  text: () => Promise.resolve(JSON.stringify(body))
});

describe("api PM adapter", () => {
  it("reads normalized periodic maintenance through the production bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true, tasks: [{ id: "pm-1" }] }));
    const provider = createApiPmProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.list()).resolves.toEqual({ ok: true, tasks: [{ id: "pm-1" }] });
    await expect(provider.get("pm-1")).resolves.toEqual({ ok: true, tasks: [{ id: "pm-1" }] });

    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      "https://cmms.example/api/pm",
      "https://cmms.example/api/pm?id=pm-1"
    ]);
  });

  it("posts periodic maintenance tasks to the normalized API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true, task: { id: "pm-1" } }));
    const provider = createApiPmProvider({
      baseUrl: "https://cmms.example/api///",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.upsert({ id: "pm-1", title: "TO" })).resolves.toEqual({ ok: true, task: { id: "pm-1" } });

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/pm", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      },
      body: JSON.stringify({ task: { id: "pm-1", title: "TO" } })
    });
  });

  it("throws the API error without hiding the backend reason", async () => {
    const provider = createApiPmProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl: vi.fn().mockResolvedValue(errorResponse(403, { error: "permission_denied" }))
    });

    await expect(provider.upsert({ id: "pm-1" })).rejects.toThrow("permission_denied");
  });

  it("deletes normalized periodic maintenance through the same API route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true }));
    const provider = createApiPmProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.delete("pm-1")).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/pm?id=pm-1", {
      method: "DELETE",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      }
    });
  });

  it("stays disabled when no API base URL is configured", () => {
    expect(createApiPmProvider({ baseUrl: "" })).toBeNull();
  });
});
