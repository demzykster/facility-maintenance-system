import { describe, expect, it, vi } from "vitest";
import { createSettingsRecordsApiHandler } from "../server/settings/recordsHandler.js";

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

describe("settings records API handler", () => {
  it("lists locations for active roles", async () => {
    const locations = { list: vi.fn().mockResolvedValue([{ id: "loc-1", name: "מחסן" }]), get: vi.fn() };
    const handler = createSettingsRecordsApiHandler({
      drivers: { locations },
      sessionClient: sessionClientFor({ role: "worker" })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer token" },
      query: { resource: "locations" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, locations: [{ id: "loc-1", name: "מחסן" }] });
  });

  it("requires settings management to list app issues", async () => {
    const appIssues = { list: vi.fn() };
    const handler = createSettingsRecordsApiHandler({
      drivers: { appIssues },
      sessionClient: sessionClientFor({ role: "worker" })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer token" },
      query: { resource: "appIssues" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:settings:manage" });
    expect(appIssues.list).not.toHaveBeenCalled();
  });

  it("allows active roles to create app issues", async () => {
    const appIssues = { upsert: vi.fn().mockResolvedValue({ id: "issue-1" }) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createSettingsRecordsApiHandler({
      drivers: { appIssues },
      auditDriver,
      sessionClient: sessionClientFor({ role: "worker" })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { resource: "appIssues", appIssue: { id: "issue-1", description: "בעיה" } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, appIssue: { id: "issue-1", sourceKvKey: "appIssue:issue-1" } });
    expect(appIssues.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "issue-1", description: "בעיה" }));
  });

  it("requires settings management to write locations", async () => {
    const locations = { upsert: vi.fn() };
    const handler = createSettingsRecordsApiHandler({
      drivers: { locations },
      sessionClient: sessionClientFor({ role: "user", permissions: { settings: "view" } })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { resource: "locations", location: { id: "loc-1", name: "מחסן" } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:settings:manage" });
    expect(locations.upsert).not.toHaveBeenCalled();
  });
});
