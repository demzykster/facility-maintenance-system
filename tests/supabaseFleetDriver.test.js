import { describe, expect, it, vi } from "vitest";
import { createSupabaseFleetDriver, createSupabaseFleetDriverFromEnv } from "../server/fleet/supabaseFleetDriver.js";

describe("Supabase fleet driver", () => {
  it("stays disabled until required server env is configured", () => {
    expect(createSupabaseFleetDriver()).toBeNull();
    expect(createSupabaseFleetDriverFromEnv({})).toBeNull();
  });

  it("lists normalized fleet rows through Supabase REST", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{
          id: "fleet-1",
          code: "178039",
          vehicle_type: "מלגזה",
          model: "8FBE15T",
          status: "active",
          source_kv_key: "fleet:fleet-1",
          legacy_payload: { id: "fleet-1", code: "178039", type: "8FBE15T" }
        }]);
      }
    });
    const driver = createSupabaseFleetDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service",
      fetchImpl
    });

    await expect(driver.list()).resolves.toEqual([{ id: "fleet-1", code: "178039", type: "8FBE15T" }]);
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/fleet_units?select=*&order=code.asc&limit=1000", expect.objectContaining({
      method: "GET"
    }));
  });

  it("upserts normalized fleet rows while preserving legacy payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{ id: "fleet-1" }]);
      }
    });
    const driver = createSupabaseFleetDriver({
      url: "https://supabase.example/",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await driver.upsert({ id: "fleet-1", code: "178039", vehicleType: "מלגזה", model: "8FBE15T", createdAt: 1000 });

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/fleet_units?on_conflict=id", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service-key",
        authorization: "Bearer service-key",
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=representation"
      })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      id: "fleet-1",
      code: "178039",
      vehicle_type: "מלגזה",
      model: "8FBE15T",
      supplier: "",
      department: "",
      location: "",
      status: "active",
      created_at: "1970-01-01T00:00:01.000Z",
      updated_at: expect.any(String),
      source_kv_key: "fleet:fleet-1",
      legacy_payload: { id: "fleet-1", code: "178039", vehicleType: "מלגזה", model: "8FBE15T", createdAt: 1000 }
    });
  });

  it("deletes fleet rows by id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return "";
      }
    });
    const driver = createSupabaseFleetDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await driver.delete("fleet-1");

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/fleet_units?id=eq.fleet-1", expect.objectContaining({
      method: "DELETE"
    }));
  });
});
