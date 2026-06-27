import { describe, expect, it, vi } from "vitest";
import { createFileApiHandler } from "../api/files/handler.js";

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
});
