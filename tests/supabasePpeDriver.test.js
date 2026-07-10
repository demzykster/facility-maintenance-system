import { describe, expect, it, vi } from "vitest";
import { createSupabasePpeDriversFromEnv } from "../server/ppe/supabasePpeDriver.js";

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body)
});

describe("Supabase PPE driver", () => {
  it("lists PPE items from the configured table", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([
      { id: "item-1", name: "Vest", legacy_payload: { id: "item-1", name: "Vest" } }
    ]));
    const drivers = createSupabasePpeDriversFromEnv({
      SUPABASE_URL: "https://example.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: "service-key"
    }, fetchImpl);

    const items = await drivers.items.list({ limit: 25 });

    expect(items).toEqual([{ id: "item-1", name: "Vest" }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/ppe_items?select=*&order=name.asc&limit=25",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("upserts PPE requests with merge preference", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ id: "req-1" }]));
    const drivers = createSupabasePpeDriversFromEnv({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key"
    }, fetchImpl);

    await drivers.requests.upsert({ id: "req-1", workerName: "Worker", lines: [] });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/ppe_requests?on_conflict=id",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ prefer: "resolution=merge-duplicates,return=representation" }),
        body: expect.stringContaining("\"source_kv_key\":\"ppereq:req-1\"")
      })
    );
  });

  it("returns null drivers when Supabase env is incomplete", () => {
    const drivers = createSupabasePpeDriversFromEnv({}, vi.fn());

    expect(drivers.items).toBeNull();
    expect(drivers.requests).toBeNull();
  });
});
