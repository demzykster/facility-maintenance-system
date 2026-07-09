import { describe, expect, it, vi } from "vitest";
import { createApiCleaningComplaintsProvider, createApiWorkerAbsencesProvider } from "../src/apiCleaningRecordsAdapter.js";

const okResponse = (body = {}) => ({
  ok: true,
  text: () => Promise.resolve(JSON.stringify(body))
});

const errorResponse = (status, body = {}) => ({
  ok: false,
  status,
  text: () => Promise.resolve(JSON.stringify(body))
});

describe("api cleaning records adapter", () => {
  it("reads normalized complaints through the shared records route", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(okResponse({ ok: true, complaints: [{ id: "complaint-1" }] }))
      .mockResolvedValueOnce(okResponse({ ok: true, complaint: { id: "complaint-1" } }));
    const provider = createApiCleaningComplaintsProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.list()).resolves.toEqual({ ok: true, complaints: [{ id: "complaint-1" }] });
    await expect(provider.get("complaint-1")).resolves.toEqual({ ok: true, complaint: { id: "complaint-1" } });

    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      "https://cmms.example/api/cleaning/records?resource=complaints",
      "https://cmms.example/api/cleaning/records?resource=complaints&id=complaint-1"
    ]);
  });

  it("posts absences to the shared records route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true, absence: { id: "absence-1" } }));
    const provider = createApiWorkerAbsencesProvider({
      baseUrl: "https://cmms.example/api///",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.upsert({ id: "absence-1", userId: "worker-1" })).resolves.toEqual({ ok: true, absence: { id: "absence-1" } });

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/cleaning/records", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      },
      body: JSON.stringify({ resource: "absences", absence: { id: "absence-1", userId: "worker-1" } })
    });
  });

  it("throws the API error without hiding the backend reason", async () => {
    const provider = createApiCleaningComplaintsProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl: vi.fn().mockResolvedValue(errorResponse(403, { error: "permission_denied" }))
    });

    await expect(provider.upsert({ id: "complaint-1" })).rejects.toThrow("permission_denied");
  });

  it("deletes normalized records through the shared records route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true }));
    const provider = createApiCleaningComplaintsProvider({
      baseUrl: "https://cmms.example/api",
      fetchImpl,
      getAccessToken: () => "access-1"
    });

    await expect(provider.delete("complaint-1")).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/cleaning/records?resource=complaints&id=complaint-1", {
      method: "DELETE",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1"
      }
    });
  });

  it("stays disabled when no API base URL is configured", () => {
    expect(createApiCleaningComplaintsProvider({ baseUrl: "" })).toBeNull();
    expect(createApiWorkerAbsencesProvider({ baseUrl: "" })).toBeNull();
  });
});
