import { describe, expect, it, vi } from "vitest";
import { createSupabaseFileMetadataDriver, createSupabaseFileMetadataDriverFromEnv } from "../api/files/supabaseFileMetadataDriver.js";

describe("Supabase file metadata driver", () => {
  it("stays disabled until required server env is configured", () => {
    expect(createSupabaseFileMetadataDriver()).toBeNull();
    expect(createSupabaseFileMetadataDriverFromEnv({})).toBeNull();
  });

  it("upserts normalized file metadata rows through Supabase REST", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return "";
      }
    });
    const driver = createSupabaseFileMetadataDriver({
      url: "https://supabase.example/",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await driver.upsert({
      id: "ticket:T-1:ticket_before_photo:tickets/T-1/before.jpg",
      ownerType: "ticket",
      ownerId: "T-1",
      ownerSubId: "",
      kind: "ticket_before_photo",
      path: "tickets/T-1/before.jpg",
      contentType: "image/jpeg",
      storageProvider: "supabase",
      bucket: "cmms-files",
      sizeBytes: 128,
      createdById: "app-user-1",
      createdByName: "Owner",
      createdByRole: "admin",
      createdAt: 1000
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/file_metadata?on_conflict=id", {
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service-key",
        authorization: "Bearer service-key",
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal"
      }),
      body: JSON.stringify({
        id: "ticket:T-1:ticket_before_photo:tickets/T-1/before.jpg",
        owner_type: "ticket",
        owner_id: "T-1",
        owner_sub_id: "",
        kind: "ticket_before_photo",
        path: "tickets/T-1/before.jpg",
        content_type: "image/jpeg",
        storage_provider: "supabase",
        bucket: "cmms-files",
        size_bytes: 128,
        created_by_id: "app-user-1",
        created_by_name: "Owner",
        created_by_role: "admin",
        created_at: "1970-01-01T00:00:01.000Z",
        deleted_at: null
      })
    });
  });

  it("finds active metadata rows by path", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{
          id: "ticket:T-1:ticket_before_photo:tickets/T-1/before.jpg",
          owner_type: "ticket",
          owner_id: "T-1",
          owner_sub_id: "",
          kind: "ticket_before_photo",
          path: "tickets/T-1/before.jpg",
          content_type: "image/jpeg",
          storage_provider: "supabase",
          bucket: "cmms-files",
          size_bytes: 128,
          created_by_id: "app-user-1",
          created_by_name: "Owner",
          created_by_role: "admin",
          created_at: "1970-01-01T00:00:01.000Z",
          deleted_at: null
        }]);
      }
    });
    const driver = createSupabaseFileMetadataDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await expect(driver.findActiveByPath("tickets/T-1/before.jpg")).resolves.toMatchObject({
      ownerType: "ticket",
      ownerId: "T-1",
      kind: "ticket_before_photo",
      path: "tickets/T-1/before.jpg",
      contentType: "image/jpeg",
      deletedAt: null
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/file_metadata?path=eq.tickets%2FT-1%2Fbefore.jpg&deleted_at=is.null&select=*&limit=1", expect.objectContaining({
      method: "GET"
    }));
  });

  it("marks metadata rows deleted without deleting the row", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return "";
      }
    });
    const driver = createSupabaseFileMetadataDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await driver.markDeleted("file:1", 2000);

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/file_metadata?id=eq.file%3A1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ deleted_at: "1970-01-01T00:00:02.000Z" })
    }));
  });

  it("marks metadata rows deleted by path", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return "";
      }
    });
    const driver = createSupabaseFileMetadataDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await driver.markDeletedByPath("tickets/T-1/before.jpg", 2000);

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/file_metadata?path=eq.tickets%2FT-1%2Fbefore.jpg", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ deleted_at: "1970-01-01T00:00:02.000Z" })
    }));
  });

  it("surfaces Supabase write failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      async text() {
        return JSON.stringify({ message: "metadata conflict" });
      }
    });
    const driver = createSupabaseFileMetadataDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await expect(driver.upsert({ id: "file:1", createdAt: 1000 })).rejects.toThrow("metadata conflict");
  });
});
