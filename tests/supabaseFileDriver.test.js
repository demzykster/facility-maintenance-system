import { describe, expect, it, vi } from "vitest";
import { createSupabaseFileDriver } from "../api/files/supabaseFileDriver.js";

describe("Supabase file driver", () => {
  it("uploads, downloads, and deletes files through Supabase Storage REST", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        async text() {
          return JSON.stringify({ path: "tickets/T-1/before.jpg" });
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (name) => name === "content-type" ? "image/jpeg" : "" },
        async arrayBuffer() {
          return Buffer.from("photo-bytes").buffer;
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        async text() {
          return JSON.stringify([{ name: "tickets/T-1/before.jpg" }]);
        }
      });
    const driver = createSupabaseFileDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service-key",
      bucket: "cmms-files",
      fetchImpl
    });

    await expect(driver.upload("tickets/T-1/before.jpg", Buffer.from("photo-bytes"), "image/jpeg")).resolves.toEqual({
      path: "tickets/T-1/before.jpg",
      bucket: "cmms-files"
    });
    await expect(driver.download("tickets/T-1/before.jpg")).resolves.toMatchObject({
      contentType: "image/jpeg"
    });
    await expect(driver.delete("tickets/T-1/before.jpg")).resolves.toEqual({
      path: "tickets/T-1/before.jpg",
      bucket: "cmms-files"
    });

    expect(fetchImpl.mock.calls[0][0]).toBe("https://supabase.example/storage/v1/object/cmms-files/tickets/T-1/before.jpg");
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service-key",
        authorization: "Bearer service-key",
        "content-type": "image/jpeg",
        "x-upsert": "true"
      })
    });
    expect(fetchImpl.mock.calls[1][0]).toBe("https://supabase.example/storage/v1/object/cmms-files/tickets/T-1/before.jpg");
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({
        apikey: "service-key",
        authorization: "Bearer service-key"
      })
    });
    expect(fetchImpl.mock.calls[2][0]).toBe("https://supabase.example/storage/v1/object/cmms-files");
    expect(fetchImpl.mock.calls[2][1]).toMatchObject({
      method: "DELETE",
      headers: expect.objectContaining({
        apikey: "service-key",
        authorization: "Bearer service-key",
        "content-type": "application/json"
      }),
      body: JSON.stringify({ prefixes: ["tickets/T-1/before.jpg"] })
    });
  });

  it("stays unavailable until all server-only storage env is configured", () => {
    expect(createSupabaseFileDriver({})).toBeNull();
    expect(createSupabaseFileDriver({ url: "https://supabase.example", serviceRoleKey: "service-key" })).toBeNull();
  });
});
