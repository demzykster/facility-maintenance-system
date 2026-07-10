import { describe, expect, it, vi } from "vitest";
import { createSupabasePresenceDriverFromEnv } from "../server/presence/supabasePresenceDriver.js";

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body)
});

describe("Supabase presence driver", () => {
  it("lists technician presence from the configured table", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([
      { id: "user-1", display_name: "Tech", legacy_payload: { id: "user-1", name: "Tech" } }
    ]));
    const driver = createSupabasePresenceDriverFromEnv({
      SUPABASE_URL: "https://example.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: "service-key"
    }, fetchImpl);

    const presence = await driver.list({ limit: 25 });

    expect(presence).toEqual([{ id: "user-1", name: "Tech" }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/technician_presence?select=*&order=last_seen_at.desc&limit=25",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("upserts presence records with merge preference", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ id: "user-1" }]));
    const driver = createSupabasePresenceDriverFromEnv({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key"
    }, fetchImpl);

    await driver.upsert({ id: "user-1", name: "Tech" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/technician_presence?on_conflict=id",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ prefer: "resolution=merge-duplicates,return=representation" }),
        body: expect.stringContaining("\"source_kv_key\":\"presence:user-1\"")
      })
    );
  });

  it("returns null when Supabase env is incomplete", () => {
    expect(createSupabasePresenceDriverFromEnv({}, vi.fn())).toBeNull();
  });
});
