import { describe, expect, it, vi } from "vitest";
import { createApiFileProvider } from "../src/apiFileAdapter.js";

function ok(body = null) {
  return {
    ok: true,
    async text() {
      return body === null ? "" : JSON.stringify(body);
    }
  };
}

describe("apiFileAdapter", () => {
  it("returns null when no api url is configured", () => {
    expect(createApiFileProvider({ baseUrl: "" })).toBeNull();
  });

  it("uses the server file api contract", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok({ ok: true }))
      .mockResolvedValueOnce(ok({ path: "tickets/T-1/before.jpg", contentType: "image/jpeg", data: "abc" }))
      .mockResolvedValueOnce(ok({ ok: true }));
    const provider = createApiFileProvider({ baseUrl: "https://cmms.example/api/", fetchImpl });

    await expect(provider.upload("tickets/T-1/before.jpg", {
      data: "abc",
      contentType: "image/jpeg",
      metadata: { ownerType: "ticket", ownerId: "T-1", kind: "ticket_before_photo" }
    })).resolves.toBe(true);
    await expect(provider.download("tickets/T-1/before.jpg")).resolves.toEqual({
      path: "tickets/T-1/before.jpg",
      contentType: "image/jpeg",
      data: "abc"
    });
    await expect(provider.delete("tickets/T-1/before.jpg")).resolves.toBe(true);

    expect(fetchImpl.mock.calls.map(([url, options]) => [url, options.method || "GET"])).toEqual([
      ["https://cmms.example/api/files?path=tickets%2FT-1%2Fbefore.jpg", "POST"],
      ["https://cmms.example/api/files?path=tickets%2FT-1%2Fbefore.jpg", "GET"],
      ["https://cmms.example/api/files?path=tickets%2FT-1%2Fbefore.jpg", "DELETE"]
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      data: "abc",
      contentType: "image/jpeg",
      metadata: { ownerType: "ticket", ownerId: "T-1", kind: "ticket_before_photo" }
    });
  });

  it("adds the production access token when available", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(ok({ path: "tickets/T-1/before.jpg" }));
    const provider = createApiFileProvider({
      baseUrl: "https://cmms.example/api",
      getAccessToken: () => "access-token",
      fetchImpl
    });

    await provider.download("tickets/T-1/before.jpg");

    expect(fetchImpl).toHaveBeenCalledWith("https://cmms.example/api/files?path=tickets%2FT-1%2Fbefore.jpg", expect.objectContaining({
      headers: expect.objectContaining({
        authorization: "Bearer access-token"
      })
    }));
  });

  it("throws backend errors so callers can keep the current local fallback", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      async text() {
        return JSON.stringify({ error: "file_storage_not_configured" });
      }
    });
    const provider = createApiFileProvider({ baseUrl: "https://cmms.example/api", fetchImpl });

    await expect(provider.download("tickets/T-1/before.jpg")).rejects.toThrow("file_storage_not_configured");
  });
});
