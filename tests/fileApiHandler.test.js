import { describe, expect, it, vi } from "vitest";
import { createFileApiHandler } from "../server/files/handler.js";
import { signCmmsSessionToken } from "../server/session/cmmsSessionToken.js";

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
    },
    json() {
      return this.body ? JSON.parse(this.body) : null;
    }
  };
}

async function call(handler, req) {
  const res = createRes();
  await handler({ headers: {}, query: {}, method: "GET", ...req }, res);
  return res;
}

function activeSessionClient(profile = {}) {
  return {
    getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "owner@example.com" }),
    getAppUserProfile: vi.fn().mockResolvedValue({
      id: "app-user-1",
      auth_user_id: "auth-user-1",
      role: "admin",
      name: "Owner",
      active: true,
      must_change_password: false,
      ...profile
    })
  };
}

describe("file API handler", () => {
  it("requires a Supabase user bearer token", async () => {
    const handler = createFileApiHandler({ env: {} });

    const res = await call(handler, { query: { path: "tickets/T-1/before.jpg" } });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "supabase_access_token_required" });
  });

  it("does not claim file storage works before the backend driver is configured", async () => {
    const handler = createFileApiHandler({
      sessionClient: activeSessionClient(),
      env: {}
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "file_storage_not_configured" });
  });

  it("blocks disabled or first-password-change users before file access", async () => {
    const driver = { download: vi.fn() };
    const disabled = createFileApiHandler({
      driver,
      sessionClient: activeSessionClient({ active: false })
    });
    const mustChange = createFileApiHandler({
      driver,
      sessionClient: activeSessionClient({ must_change_password: true })
    });

    expect((await call(disabled, {
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" }
    })).json()).toEqual({ error: "app_user_disabled" });
    expect((await call(mustChange, {
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" }
    })).json()).toEqual({ error: "password_change_required" });
    expect(driver.download).not.toHaveBeenCalled();
  });

  it("serves upload, download, and delete through the configured file driver", async () => {
    const driver = {
      upload: vi.fn().mockResolvedValue(undefined),
      download: vi.fn().mockResolvedValue({
        contentType: "image/jpeg",
        buffer: Buffer.from("photo-bytes")
      }),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createFileApiHandler({
      driver,
      sessionClient: activeSessionClient()
    });

    const upload = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" },
      body: { contentType: "image/jpeg", data: Buffer.from("photo-bytes").toString("base64") }
    });
    const download = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" }
    });
    const del = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" }
    });

    expect(upload.json()).toEqual({ ok: true, path: "tickets/T-1/before.jpg", contentType: "image/jpeg" });
    expect(download.json()).toEqual({
      path: "tickets/T-1/before.jpg",
      contentType: "image/jpeg",
      data: Buffer.from("photo-bytes").toString("base64")
    });
    expect(del.json()).toEqual({ ok: true, path: "tickets/T-1/before.jpg" });
    expect(driver.upload).toHaveBeenCalledWith("tickets/T-1/before.jpg", Buffer.from("photo-bytes"), "image/jpeg", expect.any(Object));
    expect(driver.download).toHaveBeenCalledWith("tickets/T-1/before.jpg", expect.any(Object));
    expect(driver.delete).toHaveBeenCalledWith("tickets/T-1/before.jpg", expect.any(Object));
  });

  it("writes audit events for upload and delete, but not download", async () => {
    const driver = {
      upload: vi.fn().mockResolvedValue(undefined),
      download: vi.fn().mockResolvedValue({
        contentType: "image/jpeg",
        buffer: Buffer.from("photo-bytes")
      }),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createFileApiHandler({
      driver,
      auditDriver,
      sessionClient: activeSessionClient()
    });

    await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" },
      body: { contentType: "image/jpeg", data: Buffer.from("photo-bytes").toString("base64") }
    });
    await call(handler, {
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" }
    });
    await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" }
    });

    expect(auditDriver.write).toHaveBeenCalledTimes(2);
    expect(auditDriver.write).toHaveBeenNthCalledWith(1, expect.objectContaining({
      actorId: "app-user-1",
      entityType: "file",
      entityId: "tickets/T-1/before.jpg",
      action: "upload",
      after: expect.objectContaining({ path: "tickets/T-1/before.jpg" }),
      metadata: expect.objectContaining({ contentType: "image/jpeg" })
    }));
    expect(auditDriver.write).toHaveBeenNthCalledWith(2, expect.objectContaining({
      entityType: "file",
      entityId: "tickets/T-1/before.jpg",
      action: "delete"
    }));
  });

  it("upserts file metadata for uploads when metadata and a metadata sink are provided", async () => {
    const driver = { upload: vi.fn().mockResolvedValue(undefined) };
    const metadataDriver = { upsert: vi.fn().mockResolvedValue(undefined) };
    const handler = createFileApiHandler({
      driver,
      metadataDriver,
      sessionClient: activeSessionClient()
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" },
      body: {
        contentType: "image/jpeg",
        data: Buffer.from("photo-bytes").toString("base64"),
        metadata: {
          ownerType: "ticket",
          ownerId: "T-1",
          kind: "ticket_before_photo"
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(metadataDriver.upsert).toHaveBeenCalledWith(expect.objectContaining({
      ownerType: "ticket",
      ownerId: "T-1",
      kind: "ticket_before_photo",
      path: "tickets/T-1/before.jpg",
      contentType: "image/jpeg",
      sizeBytes: Buffer.from("photo-bytes").length,
      createdById: "app-user-1",
      createdByName: "Owner",
      createdByRole: "admin"
    }));
  });

  it("soft-deletes file metadata by path when a file is deleted", async () => {
    const driver = { delete: vi.fn().mockResolvedValue(undefined) };
    const metadataDriver = { markDeletedByPath: vi.fn().mockResolvedValue(undefined) };
    const handler = createFileApiHandler({
      driver,
      metadataDriver,
      sessionClient: activeSessionClient()
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.delete).toHaveBeenCalledWith("tickets/T-1/before.jpg", expect.any(Object));
    expect(metadataDriver.markDeletedByPath).toHaveBeenCalledWith("tickets/T-1/before.jpg");
  });

  it("requires active file metadata before download or delete when metadata lookup is configured", async () => {
    const driver = {
      download: vi.fn(),
      delete: vi.fn()
    };
    const metadataDriver = {
      findActiveByPath: vi.fn().mockResolvedValue(null)
    };
    const handler = createFileApiHandler({
      driver,
      metadataDriver,
      sessionClient: activeSessionClient()
    });

    const download = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" }
    });
    const del = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" }
    });

    expect(download.statusCode).toBe(404);
    expect(download.json()).toEqual({ error: "file_metadata_not_found" });
    expect(del.statusCode).toBe(404);
    expect(del.json()).toEqual({ error: "file_metadata_not_found" });
    expect(metadataDriver.findActiveByPath).toHaveBeenCalledTimes(2);
    expect(driver.download).not.toHaveBeenCalled();
    expect(driver.delete).not.toHaveBeenCalled();
  });

  it("requires business owner permission before downloading or deleting active ticket files", async () => {
    const driver = {
      download: vi.fn(),
      delete: vi.fn()
    };
    const metadataDriver = {
      findActiveByPath: vi.fn().mockResolvedValue({
        ownerType: "ticket",
        ownerId: "T-1",
        kind: "ticket_before_photo",
        path: "tickets/T-1/before.jpg"
      })
    };
    const handler = createFileApiHandler({
      driver,
      metadataDriver,
      sessionClient: activeSessionClient({ role: "cleaner" })
    });

    const download = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" }
    });
    const del = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" }
    });

    expect(download.statusCode).toBe(403);
    expect(download.json()).toEqual({ error: "permission_required:files:ticket" });
    expect(del.statusCode).toBe(403);
    expect(del.json()).toEqual({ error: "permission_required:files:ticket" });
    expect(driver.download).not.toHaveBeenCalled();
    expect(driver.delete).not.toHaveBeenCalled();
  });

  it("requires ticket read scope before downloading active ticket files", async () => {
    const driver = { download: vi.fn() };
    const metadataDriver = {
      findActiveByPath: vi.fn().mockResolvedValue({
        ownerType: "ticket",
        ownerId: "T-other",
        kind: "ticket_before_photo",
        path: "tickets/T-other/before.jpg"
      })
    };
    const ticketDriver = {
      get: vi.fn().mockResolvedValue({
        id: "T-other",
        track: "facility",
        status: "open",
        reportedBy: { id: "worker-2", name: "Other" }
      })
    };
    const handler = createFileApiHandler({
      driver,
      metadataDriver,
      ticketDriver,
      sessionClient: activeSessionClient({ id: "worker-1", role: "worker", name: "Worker" })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-other/before.jpg" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:files:ticket_scope" });
    expect(driver.download).not.toHaveBeenCalled();
  });

  it("accepts a CMMS session token before applying ticket file read scope", async () => {
    const secret = "local-session-secret";
    const token = signCmmsSessionToken("worker-1", "worker", "1042", secret).token;
    const driver = {
      download: vi.fn().mockResolvedValue({
        contentType: "image/jpeg",
        buffer: Buffer.from("photo-bytes")
      })
    };
    const metadataDriver = {
      findActiveByPath: vi.fn().mockResolvedValue({
        ownerType: "ticket",
        ownerId: "T-own",
        kind: "ticket_before_photo",
        path: "tickets/T-own/before.jpg"
      })
    };
    const ticketDriver = {
      get: vi.fn().mockResolvedValue({
        id: "T-own",
        track: "facility",
        status: "open",
        reportedBy: { id: "worker-1", name: "Worker" }
      })
    };
    const sessionClient = activeSessionClient();
    const handler = createFileApiHandler({
      driver,
      metadataDriver,
      ticketDriver,
      sessionClient,
      env: { CMMS_SESSION_SECRET: secret }
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` },
      query: { path: "tickets/T-own/before.jpg" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      path: "tickets/T-own/before.jpg",
      contentType: "image/jpeg",
      data: Buffer.from("photo-bytes").toString("base64")
    });
    expect(sessionClient.getAuthUser).not.toHaveBeenCalled();
    expect(driver.download).toHaveBeenCalledWith("tickets/T-own/before.jpg", expect.objectContaining({
      id: "worker-1",
      role: "worker"
    }));
  });

  it("requires business owner write permission before uploading ticket metadata files", async () => {
    const driver = { upload: vi.fn() };
    const metadataDriver = { upsert: vi.fn() };
    const handler = createFileApiHandler({
      driver,
      metadataDriver,
      sessionClient: activeSessionClient({ role: "cleaner" })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" },
      body: {
        contentType: "image/jpeg",
        data: Buffer.from("photo-bytes").toString("base64"),
        metadata: {
          ownerType: "ticket",
          ownerId: "T-1",
          kind: "ticket_before_photo"
        }
      }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:files:ticket" });
    expect(driver.upload).not.toHaveBeenCalled();
    expect(metadataDriver.upsert).not.toHaveBeenCalled();
  });

  it("requires cleaning access before downloading cleaning-owned files", async () => {
    const driver = { download: vi.fn() };
    const metadataDriver = {
      findActiveByPath: vi.fn().mockResolvedValue({
        ownerType: "cleaning_complaint",
        ownerId: "complaint-1",
        kind: "cleaning_complaint_photo",
        path: "cleaning/complaints/complaint-1/photo.jpg"
      })
    };
    const handler = createFileApiHandler({
      driver,
      metadataDriver,
      sessionClient: activeSessionClient({ role: "tech" })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      query: { path: "cleaning/complaints/complaint-1/photo.jpg" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:files:cleaning" });
    expect(driver.download).not.toHaveBeenCalled();
  });

  it("rejects active file metadata that does not match the storage path owner", async () => {
    const driver = {
      download: vi.fn(),
      delete: vi.fn()
    };
    const metadataDriver = {
      findActiveByPath: vi.fn().mockResolvedValue({
        ownerType: "ticket",
        ownerId: "T-1",
        kind: "ticket_before_photo",
        path: "tickets/T-2/before.jpg"
      })
    };
    const handler = createFileApiHandler({
      driver,
      metadataDriver,
      sessionClient: activeSessionClient()
    });

    const download = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-2/before.jpg" }
    });
    const del = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-2/before.jpg" }
    });

    expect(download.statusCode).toBe(400);
    expect(download.json()).toEqual({ error: "file_metadata_path_owner_mismatch" });
    expect(del.statusCode).toBe(400);
    expect(del.json()).toEqual({ error: "file_metadata_path_owner_mismatch" });
    expect(driver.download).not.toHaveBeenCalled();
    expect(driver.delete).not.toHaveBeenCalled();
  });

  it("does not silently drop provided upload metadata when no metadata sink is configured", async () => {
    const driver = { upload: vi.fn() };
    const handler = createFileApiHandler({
      driver,
      sessionClient: activeSessionClient()
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" },
      body: {
        contentType: "image/jpeg",
        data: Buffer.from("photo-bytes").toString("base64"),
        metadata: {
          ownerType: "ticket",
          ownerId: "T-1",
          kind: "ticket_before_photo"
        }
      }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "file_metadata_not_configured" });
    expect(driver.upload).not.toHaveBeenCalled();
  });

  it("requires upload metadata when a metadata sink is configured", async () => {
    const driver = { upload: vi.fn() };
    const metadataDriver = { upsert: vi.fn() };
    const handler = createFileApiHandler({
      driver,
      metadataDriver,
      sessionClient: activeSessionClient()
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" },
      body: {
        contentType: "image/jpeg",
        data: Buffer.from("photo-bytes").toString("base64")
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "file_metadata_required" });
    expect(driver.upload).not.toHaveBeenCalled();
    expect(metadataDriver.upsert).not.toHaveBeenCalled();
  });

  it("rejects upload metadata that does not match the storage path owner", async () => {
    const driver = { upload: vi.fn() };
    const metadataDriver = { upsert: vi.fn() };
    const handler = createFileApiHandler({
      driver,
      metadataDriver,
      sessionClient: activeSessionClient()
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-2/before.jpg" },
      body: {
        contentType: "image/jpeg",
        data: Buffer.from("photo-bytes").toString("base64"),
        metadata: {
          ownerType: "ticket",
          ownerId: "T-1",
          kind: "ticket_before_photo"
        }
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "file_metadata_path_owner_mismatch" });
    expect(driver.upload).not.toHaveBeenCalled();
    expect(metadataDriver.upsert).not.toHaveBeenCalled();
  });

  it("rejects uploads that exceed the configured file size limit", async () => {
    const driver = { upload: vi.fn() };
    const metadataDriver = { upsert: vi.fn() };
    const handler = createFileApiHandler({
      driver,
      metadataDriver,
      sessionClient: activeSessionClient(),
      env: { CMMS_FILE_MAX_BYTES: "4" }
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      query: { path: "tickets/T-1/before.jpg" },
      body: {
        contentType: "image/jpeg",
        data: Buffer.from("12345").toString("base64"),
        metadata: {
          ownerType: "ticket",
          ownerId: "T-1",
          kind: "ticket_before_photo"
        }
      }
    });

    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: "file_too_large", maxBytes: 4 });
    expect(driver.upload).not.toHaveBeenCalled();
    expect(metadataDriver.upsert).not.toHaveBeenCalled();
  });

  it("rejects unsafe or missing storage paths", async () => {
    const driver = { download: vi.fn() };
    const handler = createFileApiHandler({
      driver,
      sessionClient: activeSessionClient()
    });

    for (const path of ["", "../secret", "tickets//bad.jpg"]) {
      const res = await call(handler, {
        headers: { authorization: "Bearer user-token" },
        query: { path }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "path_required" });
    }
    expect(driver.download).not.toHaveBeenCalled();
  });

  it("rejects file paths outside the configured allowed prefixes", async () => {
    const driver = { download: vi.fn() };
    const handler = createFileApiHandler({
      driver,
      sessionClient: activeSessionClient()
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      query: { path: "private/secret.jpg" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "file_path_forbidden" });
    expect(driver.download).not.toHaveBeenCalled();
  });
});
