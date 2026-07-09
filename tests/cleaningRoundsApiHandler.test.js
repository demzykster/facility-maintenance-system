import { describe, expect, it, vi } from "vitest";
import { createCleaningRoundsApiHandler } from "../server/cleaning/roundsHandler.js";
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

function sessionClientFor(profile = {}) {
  return {
    getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "manager@example.com" }),
    getAppUserProfile: vi.fn().mockResolvedValue({
      id: "app-user-1",
      auth_user_id: "auth-user-1",
      role: "user",
      name: "Manager",
      active: true,
      permissions: {},
      must_change_password: false,
      ...profile
    })
  };
}

describe("cleaning rounds API handler", () => {
  it("requires a Supabase or CMMS bearer token", async () => {
    const handler = createCleaningRoundsApiHandler({ driver: { list: vi.fn() } });

    const res = await call(handler, {});

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "supabase_access_token_required" });
  });

  it("lists cleaning rounds for legacy cleaner sessions", async () => {
    const driver = { list: vi.fn().mockResolvedValue([{ id: "round-1", zoneId: "zone-1" }]), get: vi.fn() };
    const handler = createCleaningRoundsApiHandler({
      driver,
      sessionClient: sessionClientFor({ role: "cleaner" })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer cleaner-token" },
      query: { limit: "25" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, rounds: [{ id: "round-1", zoneId: "zone-1" }] });
    expect(driver.list).toHaveBeenCalledWith({ limit: "25" });
  });

  it("blocks workers without cleaning access from reading cleaning rounds", async () => {
    const driver = { list: vi.fn(), get: vi.fn() };
    const token = signCmmsSessionToken("worker-1", "worker", "1042", "session-secret", Date.now()).token;
    const handler = createCleaningRoundsApiHandler({
      driver,
      env: { CMMS_SESSION_SECRET: "session-secret" }
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:cleaning:view" });
    expect(driver.list).not.toHaveBeenCalled();
  });

  it("upserts cleaning rounds for sessions allowed to perform cleaning", async () => {
    const driver = { upsert: vi.fn().mockResolvedValue({ id: "round-1" }) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createCleaningRoundsApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ role: "cleaner" })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer cleaner-token" },
      body: { round: { id: "round-1", zoneId: "zone-1", byName: "Cleaner" } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, round: { id: "round-1", zoneId: "zone-1", sourceKvKey: "cround:round-1" } });
    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "round-1", zoneId: "zone-1" }));
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "cleaning",
      entityId: "round-1",
      action: "update"
    }));
  });

  it("deletes cleaning rounds for sessions allowed to perform cleaning", async () => {
    const driver = { delete: vi.fn().mockResolvedValue(undefined) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createCleaningRoundsApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ role: "cleaner" })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer cleaner-token" },
      query: { id: "round-1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, round: { id: "round-1" } });
    expect(driver.delete).toHaveBeenCalledWith("round-1");
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "cleaning",
      entityId: "round-1",
      action: "delete"
    }));
  });
});
