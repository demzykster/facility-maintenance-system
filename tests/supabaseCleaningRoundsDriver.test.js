import { describe, expect, it, vi } from "vitest";
import { createSupabaseCleaningRoundsDriver, createSupabaseCleaningRoundsDriverFromEnv } from "../server/cleaning/supabaseCleaningRoundsDriver.js";

describe("Supabase cleaning rounds driver", () => {
  it("stays disabled until required server env is configured", () => {
    expect(createSupabaseCleaningRoundsDriver()).toBeNull();
    expect(createSupabaseCleaningRoundsDriverFromEnv({})).toBeNull();
  });

  it("lists cleaning rounds through Supabase REST", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{
          id: "round-1",
          zone_id: "zone-1",
          cleaner_name: "Cleaner",
          source_kv_key: "cround:round-1",
          legacy_payload: { id: "round-1", zoneId: "zone-1" }
        }]);
      }
    });
    const driver = createSupabaseCleaningRoundsDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service",
      fetchImpl
    });

    await expect(driver.list()).resolves.toEqual([{ id: "round-1", zoneId: "zone-1" }]);
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/cleaning_rounds?select=*&order=round_at.desc&limit=1000", expect.objectContaining({
      method: "GET"
    }));
  });

  it("upserts cleaning rounds while preserving legacy payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{ id: "round-1" }]);
      }
    });
    const driver = createSupabaseCleaningRoundsDriver({
      url: "https://supabase.example/",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await driver.upsert({ id: "round-1", zoneId: "zone-1", byName: "Cleaner" });

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/cleaning_rounds?on_conflict=id", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service-key",
        authorization: "Bearer service-key",
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=representation"
      })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(expect.objectContaining({
      id: "round-1",
      zone_id: "zone-1",
      cleaner_name: "Cleaner",
      source_kv_key: "cround:round-1",
      legacy_payload: { id: "round-1", zoneId: "zone-1", byName: "Cleaner" }
    }));
  });

  it("deletes cleaning rounds by id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return "";
      }
    });
    const driver = createSupabaseCleaningRoundsDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await driver.delete("round-1");

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/cleaning_rounds?id=eq.round-1", expect.objectContaining({
      method: "DELETE"
    }));
  });
});
