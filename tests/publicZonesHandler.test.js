import { describe, expect, it, vi } from "vitest";
import { createPublicZonesHandler } from "../server/public/zonesHandler.js";

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

async function call(handler, req = {}) {
  const res = createRes();
  await handler({ headers: {}, method: "GET", ...req }, res);
  return res;
}

describe("public zones handler", () => {
  it("is GET-only", async () => {
    const driver = { listValues: vi.fn() };
    const handler = createPublicZonesHandler({ driver });

    const res = await call(handler, { method: "POST" });

    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe("GET");
    expect(driver.listValues).not.toHaveBeenCalled();
  });

  it("returns only active public zone fields", async () => {
    const driver = {
      listValues: vi.fn(async () => [
        {
          key: "czone:z1",
          value: JSON.stringify({
            name: "Lobby",
            building: "A",
            floor: "1",
            code: "L-1",
            active: true,
            cleanerId: "worker-1",
            windows: [{ time: "08:00" }]
          })
        },
        {
          key: "czone:z2",
          value: JSON.stringify({
            id: "z2",
            name: "Closed",
            active: false,
            cleanerId: "worker-2"
          })
        }
      ])
    };
    const handler = createPublicZonesHandler({ driver });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
    expect(driver.listValues).toHaveBeenCalledWith("czone:", true);
    expect(res.json()).toEqual({
      ok: true,
      zones: [{
        id: "z1",
        name: "Lobby",
        building: "A",
        floor: "1",
        code: "L-1",
        active: true
      }]
    });
  });

  it("uses normalized cleaning zones before legacy KV mirrors", async () => {
    const driver = { listValues: vi.fn() };
    const zonesDriver = {
      list: vi.fn(async () => [
        {
          id: "z1",
          name: "Lobby",
          building: "A",
          floor: "1",
          code: "L-1",
          active: true,
          cleanerId: "worker-1"
        },
        {
          id: "z2",
          name: "Closed",
          active: false
        }
      ])
    };
    const handler = createPublicZonesHandler({ driver, zonesDriver });

    const res = await call(handler);

    expect(res.statusCode).toBe(200);
    expect(zonesDriver.list).toHaveBeenCalledWith();
    expect(driver.listValues).not.toHaveBeenCalled();
    expect(res.json()).toEqual({
      ok: true,
      zones: [{
        id: "z1",
        name: "Lobby",
        building: "A",
        floor: "1",
        code: "L-1",
        active: true
      }]
    });
  });

  it("does not expose zones when the backend is unavailable", async () => {
    const handler = createPublicZonesHandler({ driver: {} });

    const res = await call(handler);

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ ok: false, error: "zones_backend_not_configured" });
  });
});
