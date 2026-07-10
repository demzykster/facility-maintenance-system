import { describe, expect, it, vi } from "vitest";
import { createApiWorkProvider } from "../src/apiWorkAdapter.js";

const response = (body = {}, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body)
});

describe("API work adapter", () => {
  it("lists work resources through the shared route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ ok: true, tasks: [{ id: "task-1" }] }));
    const provider = createApiWorkProvider({ baseUrl: "/api", fetchImpl, getAccessToken: () => "token" });

    await expect(provider.tasks.list()).resolves.toEqual({ ok: true, tasks: [{ id: "task-1" }] });
    expect(fetchImpl).toHaveBeenCalledWith("/api/work?resource=tasks", expect.objectContaining({
      method: "GET",
      credentials: "include",
      headers: expect.objectContaining({ authorization: "Bearer token" })
    }));
  });

  it("upserts meetings with resource payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ ok: true, meeting: { id: "meet-1" } }));
    const provider = createApiWorkProvider({ baseUrl: "/api", fetchImpl });

    await provider.meetings.upsert({ id: "meet-1" });

    expect(fetchImpl).toHaveBeenCalledWith("/api/work", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ resource: "meetings", meeting: { id: "meet-1" } })
    }));
  });

  it("deletes tasks through the shared route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ ok: true }));
    const provider = createApiWorkProvider({ baseUrl: "/api", fetchImpl });

    await expect(provider.tasks.delete("task-1")).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith("/api/work?resource=tasks&id=task-1", expect.objectContaining({ method: "DELETE" }));
  });
});
