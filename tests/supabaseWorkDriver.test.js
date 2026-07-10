import { describe, expect, it, vi } from "vitest";
import { createSupabaseWorkDriversFromEnv } from "../server/work/supabaseWorkDriver.js";

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body)
});

describe("Supabase work driver", () => {
  it("lists maintenance tasks from the configured table", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([
      { id: "task-1", title: "Inspect", legacy_payload: { id: "task-1", title: "Inspect" } }
    ]));
    const drivers = createSupabaseWorkDriversFromEnv({
      SUPABASE_URL: "https://example.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: "service-key"
    }, fetchImpl);

    const tasks = await drivers.tasks.list({ limit: 25 });

    expect(tasks).toEqual([{ id: "task-1", title: "Inspect" }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/maintenance_tasks?select=*&order=created_at.desc&limit=25",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("upserts maintenance meetings with merge preference", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ id: "meet-1" }]));
    const drivers = createSupabaseWorkDriversFromEnv({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key"
    }, fetchImpl);

    await drivers.meetings.upsert({ id: "meet-1", title: "Weekly" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/maintenance_meetings?on_conflict=id",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ prefer: "resolution=merge-duplicates,return=representation" }),
        body: expect.stringContaining("\"source_kv_key\":\"mmeet:meet-1\"")
      })
    );
  });

  it("returns null drivers when Supabase env is incomplete", () => {
    const drivers = createSupabaseWorkDriversFromEnv({}, vi.fn());

    expect(drivers.tasks).toBeNull();
    expect(drivers.meetings).toBeNull();
  });
});
