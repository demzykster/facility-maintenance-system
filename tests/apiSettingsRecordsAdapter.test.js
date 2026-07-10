import { describe, expect, it, vi } from "vitest";
import { createApiSettingsRecordsProvider } from "../src/apiSettingsRecordsAdapter.js";

const okResponse = (body) => ({
  ok: true,
  text: () => Promise.resolve(JSON.stringify(body))
});

describe("API settings records adapter", () => {
  it("lists locations and app issues through the grouped settings route", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(okResponse({ ok: true, locations: [{ id: "loc-1" }] }))
      .mockResolvedValueOnce(okResponse({ ok: true, appIssues: [{ id: "issue-1" }] }));
    const provider = createApiSettingsRecordsProvider({ baseUrl: "/api", fetchImpl, getAccessToken: () => "token" });

    await expect(provider.locations.list()).resolves.toEqual({ ok: true, locations: [{ id: "loc-1" }] });
    await expect(provider.appIssues.list()).resolves.toEqual({ ok: true, appIssues: [{ id: "issue-1" }] });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, "/api/settings/records?resource=locations", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({ authorization: "Bearer token" })
    }));
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "/api/settings/records?resource=appIssues", expect.objectContaining({
      method: "GET"
    }));
  });

  it("posts app issue updates to the normalized API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ok: true, appIssue: { id: "issue-1" } }));
    const provider = createApiSettingsRecordsProvider({ baseUrl: "/api", fetchImpl });

    await expect(provider.appIssues.upsert({ id: "issue-1", description: "בעיה" })).resolves.toEqual({ ok: true, appIssue: { id: "issue-1" } });

    expect(fetchImpl).toHaveBeenCalledWith("/api/settings/records", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ resource: "appIssues", appIssue: { id: "issue-1", description: "בעיה" } })
    }));
  });
});
