import { describe, expect, it, vi } from "vitest";
import { createCleaningRecordsApiHandler } from "../server/cleaning/recordsHandler.js";
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

describe("cleaning records API handler", () => {
  it("requires a resource", async () => {
    const handler = createCleaningRecordsApiHandler({
      drivers: { complaints: { list: vi.fn() }, absences: { list: vi.fn() } },
      sessionClient: sessionClientFor({ role: "admin" })
    });
    const res = await call(handler, { headers: { authorization: "Bearer token" } });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "cleaning_records_resource_required" });
  });

  it("lists cleaning zones through the shared records route", async () => {
    const zones = { list: vi.fn().mockResolvedValue([{ id: "zone-1", name: "Lobby" }]), get: vi.fn() };
    const handler = createCleaningRecordsApiHandler({
      drivers: { zones },
      sessionClient: sessionClientFor({ role: "cleaner" })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer cleaner-token" },
      query: { resource: "zones", limit: "25" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, zones: [{ id: "zone-1", name: "Lobby" }] });
    expect(zones.list).toHaveBeenCalledWith({ limit: "25" });
  });

  it("upserts cleaning rounds through the shared records route", async () => {
    const rounds = { upsert: vi.fn().mockResolvedValue({ id: "round-1" }) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createCleaningRecordsApiHandler({
      drivers: { rounds },
      auditDriver,
      sessionClient: sessionClientFor({ role: "cleaner" })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer cleaner-token" },
      body: { resource: "rounds", round: { id: "round-1", zoneId: "zone-1", byName: "Cleaner" } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, round: { id: "round-1", sourceKvKey: "cround:round-1" } });
    expect(rounds.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "round-1", zoneId: "zone-1" }));
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "cleaning",
      entityId: "round-1",
      action: "update"
    }));
  });

  it("lists cleaning complaints for cleaning managers", async () => {
    const complaints = { list: vi.fn().mockResolvedValue([{ id: "complaint-1" }]), get: vi.fn() };
    const handler = createCleaningRecordsApiHandler({
      drivers: { complaints },
      sessionClient: sessionClientFor({ role: "user", permissions: { cleaning: "view" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer manager-token" },
      query: { resource: "complaints", limit: "25" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, complaints: [{ id: "complaint-1" }] });
    expect(complaints.list).toHaveBeenCalledWith({ limit: "25" });
  });

  it("blocks workers without cleaning access from reading records", async () => {
    const token = signCmmsSessionToken("worker-1", "worker", "1042", "session-secret", Date.now()).token;
    const complaints = { list: vi.fn(), get: vi.fn() };
    const handler = createCleaningRecordsApiHandler({
      drivers: { complaints },
      env: { CMMS_SESSION_SECRET: "session-secret" }
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` },
      query: { resource: "complaints" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:cleaning:view" });
    expect(complaints.list).not.toHaveBeenCalled();
  });

  it("upserts cleaning complaints for sessions allowed to perform cleaning", async () => {
    const complaints = { upsert: vi.fn().mockResolvedValue({ id: "complaint-1" }) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createCleaningRecordsApiHandler({
      drivers: { complaints },
      auditDriver,
      sessionClient: sessionClientFor({ role: "cleaner" })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer cleaner-token" },
      body: { resource: "complaints", complaint: { id: "complaint-1", zoneId: "zone-1", kind: "dirty" } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, complaint: { id: "complaint-1", sourceKvKey: "ccomplaint:complaint-1" } });
    expect(complaints.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "complaint-1", zoneId: "zone-1" }));
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "cleaning",
      entityId: "complaint-1",
      action: "update"
    }));
  });

  it("upserts worker absences only for settings managers", async () => {
    const absences = { upsert: vi.fn().mockResolvedValue({ id: "absence-1" }) };
    const handler = createCleaningRecordsApiHandler({
      drivers: { absences },
      sessionClient: sessionClientFor({ role: "user", permissions: { settings: "manage" } })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer manager-token" },
      body: { resource: "absences", absence: { id: "absence-1", userId: "worker-1", from: "2026-07-10" } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, absence: { id: "absence-1", sourceKvKey: "cabsence:absence-1" } });
    expect(absences.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "absence-1", userId: "worker-1" }));
  });

  it("blocks non-settings managers from writing worker absences", async () => {
    const absences = { upsert: vi.fn() };
    const handler = createCleaningRecordsApiHandler({
      drivers: { absences },
      sessionClient: sessionClientFor({ role: "cleaner" })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer cleaner-token" },
      body: { resource: "absences", absence: { id: "absence-1", userId: "worker-1", from: "2026-07-10" } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:settings:manage" });
    expect(absences.upsert).not.toHaveBeenCalled();
  });

  it("deletes records through the selected backend", async () => {
    const complaints = { delete: vi.fn().mockResolvedValue(undefined) };
    const handler = createCleaningRecordsApiHandler({
      drivers: { complaints },
      sessionClient: sessionClientFor({ role: "cleaner" })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer cleaner-token" },
      query: { resource: "complaints", id: "complaint-1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, complaint: { id: "complaint-1" } });
    expect(complaints.delete).toHaveBeenCalledWith("complaint-1");
  });
});
