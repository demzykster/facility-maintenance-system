import { describe, expect, it, vi } from "vitest";
import { createSupabaseCleaningComplaintsDriver, createSupabaseCleaningComplaintsDriverFromEnv, createSupabaseWorkerAbsencesDriver, createSupabaseWorkerAbsencesDriverFromEnv } from "../server/cleaning/supabaseCleaningRecordsDriver.js";

describe("Supabase cleaning records drivers", () => {
  it("stay disabled until required server env is configured", () => {
    expect(createSupabaseCleaningComplaintsDriver()).toBeNull();
    expect(createSupabaseWorkerAbsencesDriver()).toBeNull();
    expect(createSupabaseCleaningComplaintsDriverFromEnv({})).toBeNull();
    expect(createSupabaseWorkerAbsencesDriverFromEnv({})).toBeNull();
  });

  it("lists cleaning complaints through Supabase REST", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{
          id: "complaint-1",
          zone_id: "zone-1",
          complaint_at: "2026-07-10T00:00:00.000Z",
          source_kv_key: "ccomplaint:complaint-1",
          legacy_payload: { id: "complaint-1", zoneId: "zone-1" }
        }]);
      }
    });
    const driver = createSupabaseCleaningComplaintsDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service",
      fetchImpl
    });

    await expect(driver.list()).resolves.toEqual([{ id: "complaint-1", zoneId: "zone-1" }]);
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/cleaning_complaints?select=*&order=complaint_at.desc&limit=1000", expect.objectContaining({
      method: "GET"
    }));
  });

  it("upserts cleaning complaints while preserving legacy payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{ id: "complaint-1" }]);
      }
    });
    const driver = createSupabaseCleaningComplaintsDriver({
      url: "https://supabase.example/",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await driver.upsert({ id: "complaint-1", zoneId: "zone-1", kind: "dirty" });

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/cleaning_complaints?on_conflict=id", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service-key",
        authorization: "Bearer service-key",
        prefer: "resolution=merge-duplicates,return=representation"
      })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(expect.objectContaining({
      id: "complaint-1",
      zone_id: "zone-1",
      kind: "dirty",
      source_kv_key: "ccomplaint:complaint-1",
      legacy_payload: { id: "complaint-1", zoneId: "zone-1", kind: "dirty" }
    }));
  });

  it("lists worker absences through Supabase REST", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{
          id: "absence-1",
          user_name: "Cleaner",
          starts_on: "2026-07-10",
          ends_on: "2026-07-11",
          source_kv_key: "cabsence:absence-1",
          legacy_payload: { id: "absence-1", name: "Cleaner" }
        }]);
      }
    });
    const driver = createSupabaseWorkerAbsencesDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service",
      fetchImpl
    });

    await expect(driver.list()).resolves.toEqual([{ id: "absence-1", name: "Cleaner" }]);
    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/worker_absences?select=*&order=starts_on.asc&limit=1000", expect.objectContaining({
      method: "GET"
    }));
  });

  it("deletes worker absences by id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return "";
      }
    });
    const driver = createSupabaseWorkerAbsencesDriver({
      url: "https://supabase.example",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await driver.delete("absence-1");

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/worker_absences?id=eq.absence-1", expect.objectContaining({
      method: "DELETE"
    }));
  });
});
