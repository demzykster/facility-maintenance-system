import { describe, expect, it, vi } from "vitest";
import {
  buildPublicComplaintRecord,
  createPublicComplaintHandler,
  validatePublicComplaintPayload
} from "../server/public/complaintsHandler.js";

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
  await handler({ headers: {}, method: "POST", body: {}, ...req }, res);
  return res;
}

const photo = "data:image/jpeg;base64,abcd1234=";

describe("public complaint handler", () => {
  it("is POST-only", async () => {
    const driver = { get: vi.fn(), set: vi.fn() };
    const handler = createPublicComplaintHandler({
      driver,
      env: { CMMS_PUBLIC_COMPLAINTS_ENABLED: "true" }
    });

    const res = await call(handler, { method: "GET" });

    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe("POST");
    expect(driver.get).not.toHaveBeenCalled();
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("is closed unless explicitly enabled", async () => {
    const handler = createPublicComplaintHandler({ driver: { get: vi.fn(), set: vi.fn() }, env: {} });

    const res = await call(handler, {
      body: { zoneId: "zone-1", kind: "dirty", photo }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "public_complaints_disabled" });
  });

  it("validates only the narrow public payload", () => {
    expect(validatePublicComplaintPayload({ zoneId: "../secret", kind: "dirty", photo })).toEqual({
      ok: false,
      status: 400,
      error: "zone_id_required"
    });
    expect(validatePublicComplaintPayload({ zoneId: "zone-1", kind: "round", photo })).toEqual({
      ok: false,
      status: 400,
      error: "kind_invalid"
    });
    expect(validatePublicComplaintPayload({ zoneId: "zone-1", kind: "dirty" })).toEqual({
      ok: false,
      status: 400,
      error: "photo_required"
    });
  });

  it("creates exactly one pending anonymous complaint under a server-chosen key", async () => {
    const driver = {
      get: vi.fn(async (key) => {
        if (key.startsWith("publicComplaintRate:")) return null;
        if (key === "czone:zone-1") return JSON.stringify({
          id: "zone-1",
          name: "Lobby",
          building: "A",
          floor: "1"
        });
        return null;
      }),
      set: vi.fn()
    };
    const handler = createPublicComplaintHandler({
      driver,
      env: { CMMS_PUBLIC_COMPLAINTS_ENABLED: "true" },
      now: () => 123456,
      createId: () => "complaint-1"
    });

    const res = await call(handler, {
      headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "browser" },
      body: {
        zoneId: "zone-1",
        zoneName: "Injected",
        status: "open",
        key: "ticket:1",
        kind: "dirty",
        text: "  Spill  ",
        photo
      }
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true, id: "complaint-1", status: "pending" });
    expect(driver.get).toHaveBeenCalledWith(expect.stringMatching(/^publicComplaintRate:/), false);
    expect(driver.get).toHaveBeenCalledWith("czone:zone-1", true);
    expect(driver.set).toHaveBeenCalledWith(expect.stringMatching(/^publicComplaintRate:/), "123456", false);
    expect(driver.set).toHaveBeenCalledWith("ccomplaint:complaint-1", expect.any(String), true);
    const complaint = JSON.parse(driver.set.mock.calls.find(([key]) => key === "ccomplaint:complaint-1")[1]);
    expect(complaint).toMatchObject({
      id: "complaint-1",
      at: 123456,
      zoneId: "zone-1",
      zoneName: "Lobby",
      zoneLoc: "A · 1",
      kind: "dirty",
      text: "Spill",
      status: "pending",
      ownerRole: "cleaner",
      verified: false,
      ticketId: null,
      reportedByRole: "anonymous",
      source: "public_endpoint",
      demo: false
    });
    expect(complaint.photo).toBe(photo);
  });

  it("writes a sanitized audit event after a successful public complaint create", async () => {
    const driver = {
      get: vi.fn(async (key) => {
        if (key.startsWith("publicComplaintRate:")) return null;
        if (key === "czone:zone-1") return JSON.stringify({
          id: "zone-1",
          name: "Server Lobby",
          building: "A",
          floor: "1",
          active: true
        });
        return null;
      }),
      set: vi.fn()
    };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createPublicComplaintHandler({
      driver,
      auditDriver,
      env: {
        CMMS_PUBLIC_COMPLAINTS_ENABLED: "true",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-secret"
      },
      now: () => 123456,
      createId: () => "complaint-1"
    });

    const res = await call(handler, {
      headers: {
        authorization: "Bearer public-token",
        apikey: "client-api-key",
        "x-forwarded-for": "203.0.113.10",
        "user-agent": "browser"
      },
      body: {
        zoneId: "zone-1",
        zoneName: "Client Injected Zone",
        status: "closed",
        ownerRole: "admin",
        reportedByRole: "admin",
        kind: "dirty",
        text: "  Spill near entrance  ",
        photo
      }
    });

    expect(res.statusCode).toBe(201);
    expect(auditDriver.write).toHaveBeenCalledTimes(1);
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "",
      actorRole: "public",
      entityType: "cleaning",
      entityId: "complaint-1",
      action: "create",
      after: expect.objectContaining({
        complaintId: "complaint-1",
        zoneId: "zone-1",
        zoneName: "Server Lobby",
        zoneLoc: "A · 1",
        kind: "dirty",
        details: "Spill near entrance",
        status: "pending",
        source: "public_endpoint",
        attachment: expect.objectContaining({ hasPhoto: true })
      }),
      metadata: expect.objectContaining({
        source: "public_endpoint",
        actorType: "unauthenticated/public"
      })
    }));
    const payload = JSON.stringify(auditDriver.write.mock.calls[0][0]);
    expect(payload).not.toContain("Client Injected Zone");
    expect(payload).not.toContain("closed");
    expect(payload).not.toContain("data:image");
    expect(payload).not.toContain("public-token");
    expect(payload).not.toContain("client-api-key");
    expect(payload).not.toContain("service-role-secret");
    expect(payload).not.toContain("203.0.113.10");
    expect(payload).not.toContain("browser");
  });

  it("records stored photo metadata in audit without base64 content", async () => {
    const driver = {
      get: vi.fn(async (key) => {
        if (key.startsWith("publicComplaintRate:")) return null;
        if (key === "czone:zone-1") return JSON.stringify({ id: "zone-1", name: "Lobby" });
        return null;
      }),
      set: vi.fn()
    };
    const fileDriver = { upload: vi.fn().mockResolvedValue({ path: "cleaning/complaints/complaint-1/photo.jpg" }) };
    const metadataDriver = { upsert: vi.fn().mockResolvedValue({ ok: true }) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createPublicComplaintHandler({
      driver,
      fileDriver,
      metadataDriver,
      auditDriver,
      env: { CMMS_PUBLIC_COMPLAINTS_ENABLED: "true", CMMS_FILE_DRIVER: "supabase", CMMS_FILE_METADATA_DRIVER: "supabase" },
      now: () => 123456,
      createId: () => "complaint-1"
    });

    const res = await call(handler, {
      body: { zoneId: "zone-1", kind: "dirty", text: "Spill", photo }
    });

    expect(res.statusCode).toBe(201);
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      after: expect.objectContaining({
        attachment: {
          hasPhoto: true,
          photoPath: "cleaning/complaints/complaint-1/photo.jpg"
        }
      })
    }));
    expect(JSON.stringify(auditDriver.write.mock.calls[0][0])).not.toContain("data:image");
  });

  it("keeps the public complaint response successful when audit persistence fails", async () => {
    const driver = {
      get: vi.fn(async (key) => {
        if (key.startsWith("publicComplaintRate:")) return null;
        if (key === "czone:zone-1") return JSON.stringify({ id: "zone-1", name: "Lobby" });
        return null;
      }),
      set: vi.fn()
    };
    const complaintsDriver = { upsert: vi.fn().mockResolvedValue({ id: "complaint-1" }) };
    const auditDriver = { write: vi.fn().mockRejectedValue(new Error("audit storage failed with token secret")) };
    const logger = vi.fn();
    const handler = createPublicComplaintHandler({
      driver,
      complaintsDriver,
      auditDriver,
      logger,
      env: { CMMS_PUBLIC_COMPLAINTS_ENABLED: "true" },
      now: () => 123456,
      createId: () => "complaint-1"
    });

    const res = await call(handler, {
      body: { zoneId: "zone-1", kind: "dirty", text: "Spill", photo }
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true, id: "complaint-1", status: "pending" });
    expect(complaintsDriver.upsert).toHaveBeenCalledTimes(1);
    expect(auditDriver.write).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledTimes(1);
    const diagnostic = String(logger.mock.calls[0][0]);
    expect(diagnostic).toContain("public_complaint_audit_error");
    expect(diagnostic).toContain("complaint-1");
    expect(diagnostic).not.toContain("token secret");
    expect(diagnostic).not.toContain("Spill");
  });

  it("does not write business audit events for disabled, invalid, or rate-limited requests", async () => {
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const disabled = createPublicComplaintHandler({
      driver: { get: vi.fn(), set: vi.fn() },
      auditDriver,
      env: {}
    });
    const invalid = createPublicComplaintHandler({
      driver: { get: vi.fn(), set: vi.fn() },
      auditDriver,
      env: { CMMS_PUBLIC_COMPLAINTS_ENABLED: "true" }
    });
    const rateLimited = createPublicComplaintHandler({
      driver: {
        get: vi.fn(async (key) => key.startsWith("publicComplaintRate:") ? "123000" : null),
        set: vi.fn()
      },
      auditDriver,
      env: { CMMS_PUBLIC_COMPLAINTS_ENABLED: "true" },
      now: () => 123456
    });

    await call(disabled, { body: { zoneId: "zone-1", kind: "dirty", photo } });
    await call(invalid, { body: { zoneId: "zone-1", kind: "round", photo } });
    await call(rateLimited, { body: { zoneId: "zone-1", kind: "dirty", photo } });

    expect(auditDriver.write).not.toHaveBeenCalled();
  });

  it("writes public complaints to the normalized complaints driver without creating a KV mirror when configured", async () => {
    const driver = {
      get: vi.fn(async (key) => {
        if (key.startsWith("publicComplaintRate:")) return null;
        if (key === "czone:zone-1") return JSON.stringify({ id: "zone-1", name: "Lobby" });
        return null;
      }),
      set: vi.fn()
    };
    const complaintsDriver = { upsert: vi.fn().mockResolvedValue({ id: "complaint-1" }) };
    const handler = createPublicComplaintHandler({
      driver,
      complaintsDriver,
      env: { CMMS_PUBLIC_COMPLAINTS_ENABLED: "true" },
      now: () => 123456,
      createId: () => "complaint-1"
    });

    const res = await call(handler, {
      body: { zoneId: "zone-1", kind: "dirty", text: "Spill", photo }
    });

    expect(res.statusCode).toBe(201);
    expect(complaintsDriver.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "complaint-1",
      zoneId: "zone-1",
      status: "pending",
      source: "public_endpoint"
    }));
    expect(driver.set).not.toHaveBeenCalledWith("ccomplaint:complaint-1", expect.any(String), true);
  });

  it("loads the reported zone from normalized cleaning zones before legacy KV mirrors", async () => {
    const driver = {
      get: vi.fn(async (key) => key.startsWith("publicComplaintRate:") ? null : JSON.stringify({
        id: "zone-1",
        name: "Legacy Lobby",
        building: "Legacy",
        floor: "0"
      })),
      set: vi.fn()
    };
    const zonesDriver = {
      get: vi.fn(async () => ({
        id: "zone-1",
        name: "Normalized Lobby",
        building: "A",
        floor: "1",
        active: true
      }))
    };
    const handler = createPublicComplaintHandler({
      driver,
      zonesDriver,
      env: { CMMS_PUBLIC_COMPLAINTS_ENABLED: "true" },
      now: () => 123456,
      createId: () => "complaint-1"
    });

    const res = await call(handler, {
      body: { zoneId: "zone-1", kind: "dirty", text: "Spill", photo }
    });

    expect(res.statusCode).toBe(201);
    expect(zonesDriver.get).toHaveBeenCalledWith("zone-1");
    expect(driver.get).not.toHaveBeenCalledWith("czone:zone-1", true);
    const complaint = JSON.parse(driver.set.mock.calls.find(([key]) => key === "ccomplaint:complaint-1")[1]);
    expect(complaint).toMatchObject({
      zoneId: "zone-1",
      zoneName: "Normalized Lobby",
      zoneLoc: "A · 1"
    });
  });

  it("stores public complaint photos in file storage without embedding base64 when configured", async () => {
    const driver = {
      get: vi.fn(async (key) => {
        if (key.startsWith("publicComplaintRate:")) return null;
        if (key === "czone:zone-1") return JSON.stringify({
          id: "zone-1",
          name: "Lobby",
          building: "A",
          floor: "1"
        });
        return null;
      }),
      set: vi.fn()
    };
    const fileDriver = { upload: vi.fn().mockResolvedValue({ path: "cleaning/complaints/complaint-1/photo.jpg" }) };
    const metadataDriver = { upsert: vi.fn().mockResolvedValue({ ok: true }) };
    const handler = createPublicComplaintHandler({
      driver,
      fileDriver,
      metadataDriver,
      env: { CMMS_PUBLIC_COMPLAINTS_ENABLED: "true", CMMS_FILE_DRIVER: "supabase", CMMS_FILE_METADATA_DRIVER: "supabase" },
      now: () => 123456,
      createId: () => "complaint-1"
    });

    const res = await call(handler, {
      body: { zoneId: "zone-1", kind: "dirty", text: "Spill", photo }
    });

    expect(res.statusCode).toBe(201);
    expect(fileDriver.upload).toHaveBeenCalledWith(
      "cleaning/complaints/complaint-1/photo.jpg",
      expect.any(Buffer),
      "image/jpeg",
      expect.objectContaining({ role: "anonymous" })
    );
    expect(metadataDriver.upsert).toHaveBeenCalledWith(expect.objectContaining({
      ownerType: "cleaning_complaint",
      ownerId: "complaint-1",
      kind: "cleaning_complaint_photo",
      path: "cleaning/complaints/complaint-1/photo.jpg",
      contentType: "image/jpeg",
      createdByRole: "anonymous"
    }));
    const complaint = JSON.parse(driver.set.mock.calls.find(([key]) => key === "ccomplaint:complaint-1")[1]);
    expect(complaint).toMatchObject({
      id: "complaint-1",
      photo: null,
      photoPath: "cleaning/complaints/complaint-1/photo.jpg",
      hasPhoto: true
    });
    expect(JSON.stringify(complaint)).not.toContain("data:image");
  });

  it("does not accept public photo reports in file-storage mode without a file driver", async () => {
    const driver = { get: vi.fn(), set: vi.fn() };
    const handler = createPublicComplaintHandler({
      driver,
      env: { CMMS_PUBLIC_COMPLAINTS_ENABLED: "true", CMMS_FILE_DRIVER: "supabase" },
      now: () => 123456,
      createId: () => "complaint-1"
    });

    const res = await call(handler, {
      body: { zoneId: "zone-1", kind: "dirty", text: "Spill", photo }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "public_complaint_file_storage_not_configured" });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("rate-limits before writing the complaint", async () => {
    const driver = {
      get: vi.fn(async (key) => key.startsWith("publicComplaintRate:") ? "123000" : null),
      set: vi.fn()
    };
    const handler = createPublicComplaintHandler({
      driver,
      env: { CMMS_PUBLIC_COMPLAINTS_ENABLED: "true" },
      now: () => 123456
    });

    const res = await call(handler, {
      body: { zoneId: "zone-1", kind: "dirty", photo }
    });

    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: "public_complaint_rate_limited" });
    expect(driver.set).not.toHaveBeenCalledWith(expect.stringMatching(/^ccomplaint:/), expect.any(String), true);
  });

  it("does not trust client-supplied zone labels", () => {
    const complaint = buildPublicComplaintRecord({
      body: { kind: "broken", text: "Lamp", photo, zoneName: "Client" },
      zone: { id: "zone-1", name: "Server Zone", building: "B" },
      now: 1,
      id: "c1"
    });

    expect(complaint.zoneName).toBe("Server Zone");
    expect(complaint.status).toBe("pending");
  });
});
