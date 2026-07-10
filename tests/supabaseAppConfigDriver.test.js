import { describe, expect, it, vi } from "vitest";
import { createSupabaseAppConfigDriverFromEnv } from "../server/settings/supabaseAppConfigDriver.js";

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body)
});

describe("Supabase app config driver", () => {
  it("reads app config from the configured table", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([
      { id: "main", config: { companyName: "CDSL" }, source_kv_key: "config:v1" }
    ]));
    const driver = createSupabaseAppConfigDriverFromEnv({
      SUPABASE_URL: "https://example.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: "service-key"
    }, fetchImpl);

    const record = await driver.get();

    expect(record).toMatchObject({ id: "main", config: { companyName: "CDSL" } });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/app_config?id=eq.main&select=*&limit=1",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("upserts app config with merge preference", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ id: "main", config: { departments: ["Ops"] } }]));
    const driver = createSupabaseAppConfigDriverFromEnv({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key"
    }, fetchImpl);

    await driver.upsert({ departments: ["Ops"] });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/app_config?on_conflict=id",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ prefer: "resolution=merge-duplicates,return=representation" }),
        body: expect.stringContaining("\"source_kv_key\":\"config:v1\"")
      })
    );
  });

  it("returns null when Supabase env is incomplete", () => {
    expect(createSupabaseAppConfigDriverFromEnv({}, vi.fn())).toBeNull();
  });
});
