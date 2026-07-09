import { describe, expect, it, vi } from "vitest";
import { createSupabaseCleaningZonesDriver, createSupabaseCleaningZonesDriverFromEnv } from "../server/cleaning/supabaseCleaningZonesDriver.js";

describe("Supabase cleaning zones driver", () => {
  it("stays disabled until required server env is configured", () => {
    expect(createSupabaseCleaningZonesDriver()).toBeNull();
    expect(createSupabaseCleaningZonesDriverFromEnv({})).toBeNull();
  });

  it("lists cleaning zones through Supabase REST", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{
          id: "zone-1",
          name: "Lobby",
          area_name: "Main",
          active: true,
          source_kv_key: "czone:zone-1",
          legacy_payload: { id: "zone-1", name: "Lobby" }
        }]);
      }
    });
    const driver = createSupabaseCleaningZonesDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service",
      fetchImpl
    });

    await expect(driver.list()).resolves.toEqual([{ id: "zone-1", name: "Lobby" }]);
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/cleaning_zones?select=*&order=name.asc&limit=1000", expect.objectContaining({
      method: "GET"
    }));
  });

  it("upserts cleaning zones while preserving legacy payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{ id: "zone-1" }]);
      }
    });
    const driver = createSupabaseCleaningZonesDriver({
      url: "https://supabase.example/",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await driver.upsert({ id: "zone-1", name: "Lobby", building: "A", areaName: "Main" });

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/cleaning_zones?on_conflict=id", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service-key",
        authorization: "Bearer service-key",
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=representation"
      })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(expect.objectContaining({
      id: "zone-1",
      name: "Lobby",
      building: "A",
      area_name: "Main",
      source_kv_key: "czone:zone-1",
      legacy_payload: { id: "zone-1", name: "Lobby", building: "A", areaName: "Main" }
    }));
  });

  it("deletes cleaning zones by id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return "";
      }
    });
    const driver = createSupabaseCleaningZonesDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await driver.delete("zone-1");

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/cleaning_zones?id=eq.zone-1", expect.objectContaining({
      method: "DELETE"
    }));
  });
});
