import { describe, expect, it, vi } from "vitest";
import { createSupabaseKvDriver, createSupabaseKvDriverFromEnv } from "../server/kv/supabaseDriver.js";

function ok(body) {
  return {
    ok: true,
    async text() {
      return JSON.stringify(body);
    }
  };
}

describe("supabase KV driver", () => {
  it("is disabled until Supabase URL and service role key are configured", () => {
    expect(createSupabaseKvDriver({ url: "", serviceRoleKey: "secret" })).toBeNull();
    expect(createSupabaseKvDriver({ url: "https://supabase.example", serviceRoleKey: "" })).toBeNull();
  });

  it("maps the app KV contract to Supabase PostgREST rows", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok([{ value: "ticket-json" }]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([{ record_key: "ticket:1" }]))
      .mockResolvedValueOnce(ok([{ record_key: "ticket:1", value: "ticket-json" }]));
    const driver = createSupabaseKvDriver({
      url: "https://supabase.example/",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await expect(driver.get("ticket:1", true)).resolves.toBe("ticket-json");
    await expect(driver.set("ticket:1", "ticket-json", true)).resolves.toBeUndefined();
    await expect(driver.delete("ticket:1", true)).resolves.toBeUndefined();
    await expect(driver.list("ticket:", true)).resolves.toEqual(["ticket:1"]);
    await expect(driver.listValues("ticket:", true)).resolves.toEqual([{ key: "ticket:1", value: "ticket-json" }]);

    expect(fetchImpl.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
      ["https://supabase.example/rest/v1/cmms_kv_records?scope=eq.shared&record_key=eq.ticket%3A1&select=value&limit=1", "GET"],
      ["https://supabase.example/rest/v1/cmms_kv_records?on_conflict=scope,record_key", "POST"],
      ["https://supabase.example/rest/v1/cmms_kv_records?scope=eq.shared&record_key=eq.ticket%3A1", "DELETE"],
      ["https://supabase.example/rest/v1/cmms_kv_records?scope=eq.shared&record_key=like.ticket%3A%25&select=record_key", "GET"],
      ["https://supabase.example/rest/v1/cmms_kv_records?scope=eq.shared&record_key=like.ticket%3A%25&select=record_key,value", "GET"]
    ]);
    expect(fetchImpl.mock.calls[1][1].headers.authorization).toBe("Bearer service-key");
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      scope: "shared",
      record_key: "ticket:1",
      value: "ticket-json"
    });
  });

  it("bulk upserts multiple KV records in one Supabase request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok([]));
    const driver = createSupabaseKvDriver({
      url: "https://supabase.example/",
      serviceRoleKey: "service-key",
      fetchImpl
    });

    await expect(driver.setMany([
      { key: "fleet:1", value: "fleet-json-1" },
      { key: "fleet:2", value: "fleet-json-2" }
    ], true)).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledWith("https://supabase.example/rest/v1/cmms_kv_records?on_conflict=scope,record_key", {
      method: "POST",
      headers: expect.objectContaining({
        authorization: "Bearer service-key",
        prefer: "resolution=merge-duplicates,return=minimal"
      }),
      body: JSON.stringify([
        { scope: "shared", record_key: "fleet:1", value: "fleet-json-1" },
        { scope: "shared", record_key: "fleet:2", value: "fleet-json-2" }
      ])
    });
  });

  it("supports server Supabase env variable names", () => {
    expect(createSupabaseKvDriverFromEnv({
      SUPABASE_URL: "https://supabase.example",
      SUPABASE_SERVICE_ROLE_KEY: "service-key"
    }, vi.fn())).not.toBeNull();
  });
});
