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

  it("bulk writes audit rows in one Supabase request", async () => {
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

    await driver.writeMany([
      { id: "audit-1", at: 1000, entityType: "fleet", entityId: "fleet:1", action: "update" },
      { id: "audit-2", at: 2000, entityType: "fleet", entityId: "fleet:2", action: "update" }
    ]);

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/audit_events", {
      method: "POST",
      headers: expect.objectContaining({
        authorization: "Bearer service-key",
        prefer: "return=minimal"
      }),
      body: expect.any(String)
    });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual([
      expect.objectContaining({ id: "audit-1", entity_id: "fleet:1" }),
      expect.objectContaining({ id: "audit-2", entity_id: "fleet:2" })
    ]);
  });

  it("lists client error events from audit_events", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([
          {
            id: "audit-1",
            at: "1970-01-01T00:00:01.000Z",
            actor_id: "app-user-1",
            actor_name: "Owner",
            actor_role: "admin",
            entity_type: "system",
            entity_id: "client-error",
            action: "client_error",
            summary: "Shared storage operation failed",
            metadata: { kind: "storage_save_failed" }
          }
        ]);
      }
    });
    const driver = createSupabaseAuditDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    const rows = await driver.listClientErrors({ limit: 25 });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://supabase.example/rest/v1/audit_events?select=id,at,actor_id,actor_name,actor_role,entity_type,entity_id,action,summary,metadata&entity_type=eq.system&action=eq.client_error&order=at.desc&limit=25",
      expect.objectContaining({ method: "GET" })
    );
    expect(rows).toEqual([expect.objectContaining({
      id: "audit-1",
      at: 1000,
      actorName: "Owner",
      action: "client_error",
      metadata: { kind: "storage_save_failed" }
    })]);
  });
});
