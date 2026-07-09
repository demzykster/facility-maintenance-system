import { describe, expect, it, vi } from "vitest";
import { createSupabasePmDriver } from "../server/pm/supabasePmDriver.js";

const okResponse = (body = {}) => ({
  ok: true,
  text: () => Promise.resolve(JSON.stringify(body))
});

const errorResponse = (status, body = {}) => ({
  ok: false,
  status,
  text: () => Promise.resolve(JSON.stringify(body))
});

describe("supabase PM driver", () => {
  it("lists periodic maintenance tasks ordered by next due date", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse([
      { id: "pm-1", legacy_payload: { id: "pm-1", title: "TO" } }
    ]));
    const driver = createSupabasePmDriver({ url: "https://supabase.test", serviceRoleKey: "service", fetchImpl });

    await expect(driver.list({ limit: 25 })).resolves.toEqual([{ id: "pm-1", title: "TO" }]);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://supabase.test/rest/v1/periodic_maintenance?select=*&order=next_due.asc&limit=25",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("upserts normalized periodic maintenance rows with source payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse([{ id: "pm-1" }]));
    const driver = createSupabasePmDriver({ url: "https://supabase.test/", serviceRoleKey: "service", fetchImpl });

    await expect(driver.upsert({ id: "pm-1", forkliftId: "fleet-1", title: "TO" })).resolves.toEqual({ id: "pm-1" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://supabase.test/rest/v1/periodic_maintenance?on_conflict=id",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"source_kv_key\":\"pm:pm-1\"")
      })
    );
  });

  it("deletes by id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const driver = createSupabasePmDriver({ url: "https://supabase.test", serviceRoleKey: "service", fetchImpl });

    await expect(driver.delete("pm-1")).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://supabase.test/rest/v1/periodic_maintenance?id=eq.pm-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("surfaces backend errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errorResponse(500, { message: "db down" }));
    const driver = createSupabasePmDriver({ url: "https://supabase.test", serviceRoleKey: "service", fetchImpl });

    await expect(driver.list()).rejects.toThrow("db down");
  });
});
