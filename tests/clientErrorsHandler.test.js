import { describe, expect, it, vi } from "vitest";
import { createClientErrorsHandler } from "../server/clientErrors/handler.js";

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
  await handler({ headers: {}, method: "POST", ...req }, res);
  return res;
}

const activeSessionClient = {
  getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "admin@example.com" }),
  getAppUserProfile: vi.fn().mockResolvedValue({
    id: "app-user-1",
    auth_user_id: "auth-user-1",
    role: "admin",
    name: "Owner",
    email: "admin@example.com",
    active: true,
    permissions: {},
    must_change_password: false
  })
};

describe("client errors API handler", () => {
  it("requires an authenticated user token", async () => {
    const handler = createClientErrorsHandler({ auditDriver: { write: vi.fn() } });

    const res = await call(handler, {});

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "supabase_access_token_required" });
  });

  it("writes sanitized client storage failures to audit events", async () => {
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createClientErrorsHandler({
      auditDriver,
      sessionClient: activeSessionClient
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: {
        kind: "storage_save_failed",
        message: "Shared storage operation failed",
        operation: "set",
        key: "ticket:1234567890123456789012345",
        shared: true,
        path: "https://app.example/tickets?secret=remove-me",
        userAgent: "Browser/1.0",
        metadata: { error: "storage_api_error", actorRole: "admin", password: "must-not-log" }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      actorName: "Owner",
      actorRole: "admin",
      entityType: "system",
      entityId: "client-error",
      action: "client_error",
      summary: "Shared storage operation failed",
      metadata: expect.objectContaining({
        kind: "storage_save_failed",
        operation: "set",
        key: "ticket:123456789012345678",
        shared: true,
        path: "https://app.example/tickets",
        metadata: {
          error: "storage_api_error",
          actorRole: "admin",
          actorId: ""
        }
      })
    }));
  });
});
