import { describe, expect, it, vi } from "vitest";
import { createSupabaseAuditDriver, createSupabaseAuditDriverFromEnv } from "../server/audit/supabaseAuditDriver.js";

describe("Supabase audit driver", () => {
  it("stays disabled until required server env is configured", () => {
    expect(createSupabaseAuditDriver()).toBeNull();
    expect(createSupabaseAuditDriverFromEnv({})).toBeNull();
  });

  it("writes normalized audit rows through the Supabase REST API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return "";
      }
    });
    const driver = createSupabaseAuditDriver({
      url: "https://supabase.example/",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await driver.write({
      id: "audit-1",
      at: 1000,
      actorId: "app-user-1",
      actorName: "Owner",
      actorRole: "admin",
      entityType: "settings",
      entityId: "config:v1",
      action: "update",
      summary: "Setting updated",
      before: { value: "old" },
      after: { value: "new" },
      metadata: { key: "config:v1" }
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/audit_events", {
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service-key",
        authorization: "Bearer service-key",
        "content-type": "application/json",
        prefer: "return=minimal"
      }),
      body: JSON.stringify({
        id: "audit-1",
        at: "1970-01-01T00:00:01.000Z",
        actor_id: "app-user-1",
        actor_name: "Owner",
        actor_role: "admin",
        entity_type: "settings",
        entity_id: "config:v1",
        action: "update",
        summary: "Setting updated",
        before: { value: "old" },
        after: { value: "new" },
        metadata: { key: "config:v1" }
      })
    });
  });

  it("surfaces Supabase write failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      async text() {
        return JSON.stringify({ message: "duplicate key" });
      }
    });
    const driver = createSupabaseAuditDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await expect(driver.write({ id: "audit-1", at: 1000, entityType: "settings", action: "update" })).rejects.toThrow("duplicate key");
  });
});
