import { describe, expect, it, vi } from "vitest";
import { createSystemErrorsHandler } from "../server/systemErrors/handler.js";

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
  await handler({ headers: {}, method: "GET", url: "/api/system-errors", ...req }, res);
  return res;
}

const sessionClientFor = (profile) => ({
  getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: profile.email || "admin@example.com" }),
  getAppUserProfile: vi.fn().mockResolvedValue({
    id: profile.id || "app-user-1",
    auth_user_id: "auth-user-1",
    role: profile.role,
    name: profile.name || "Owner",
    email: profile.email || "admin@example.com",
    active: true,
    permissions: profile.permissions || {},
    must_change_password: false
  })
});

describe("system errors API handler", () => {
  it("requires an authenticated user token", async () => {
    const handler = createSystemErrorsHandler({ auditDriver: { listClientErrors: vi.fn() } });

    const res = await call(handler);

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "supabase_access_token_required" });
  });

  it("blocks regular users from viewing system errors", async () => {
    const handler = createSystemErrorsHandler({
      auditDriver: { listClientErrors: vi.fn() },
      sessionClient: sessionClientFor({ role: "user", permissions: {} })
    });

    const res = await call(handler, { headers: { authorization: "Bearer user-token" } });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "system_errors_forbidden" });
  });

  it("returns sanitized client error events for admins", async () => {
    const auditDriver = {
      listClientErrors: vi.fn().mockResolvedValue([
        {
          id: "audit-1",
          at: 1000,
          actorName: "Owner",
          actorRole: "admin",
          summary: "Shared storage operation failed",
          metadata: {
            kind: "storage_save_failed",
            operation: "set",
            key: "config:v1",
            path: "https://app.example/settings",
            metadata: { error: "storage_api_error" }
          }
        }
      ])
    };
    const handler = createSystemErrorsHandler({
      auditDriver,
      sessionClient: sessionClientFor({ role: "admin" })
    });

    const res = await call(handler, { headers: { authorization: "Bearer admin-token" }, url: "/api/system-errors?limit=10" });

    expect(res.statusCode).toBe(200);
    expect(auditDriver.listClientErrors).toHaveBeenCalledWith({ limit: 10 });
    expect(res.json()).toEqual({
      ok: true,
      errors: [{
        id: "audit-1",
        at: 1000,
        actorName: "Owner",
        actorRole: "admin",
        summary: "Shared storage operation failed",
        kind: "storage_save_failed",
        operation: "set",
        key: "config:v1",
        path: "https://app.example/settings",
        error: "storage_api_error"
      }]
    });
  });
});
