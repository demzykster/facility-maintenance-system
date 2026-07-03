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
