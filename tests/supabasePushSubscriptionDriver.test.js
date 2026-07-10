import { describe, expect, it, vi } from "vitest";
import { createSupabasePushSubscriptionDriverFromEnv } from "../server/push/supabasePushSubscriptionDriver.js";

const subscription = {
  endpoint: "https://push.example/device/1",
  keys: { p256dh: "p256", auth: "auth" }
};

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body)
});

describe("Supabase push subscription driver", () => {
  it("lists push subscriptions from the configured table", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([
      { id: "push-1", user_id: "user-1", subscription, legacy_payload: { id: "push-1", userId: "user-1", subscription } }
    ]));
    const driver = createSupabasePushSubscriptionDriverFromEnv({
      SUPABASE_URL: "https://example.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: "service-key"
    }, fetchImpl);

    const records = await driver.list({ limit: 25 });

    expect(records).toEqual([expect.objectContaining({ id: "push-1", userId: "user-1", subscription })]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/push_subscriptions?select=*&order=updated_at.desc&limit=25",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("upserts push subscriptions with merge preference", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ id: "push-1" }]));
    const driver = createSupabasePushSubscriptionDriverFromEnv({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key"
    }, fetchImpl);

    await driver.upsert({ userId: "user-1", subscription });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/push_subscriptions?on_conflict=id",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ prefer: "resolution=merge-duplicates,return=representation" }),
        body: expect.stringContaining("\"user_id\":\"user-1\"")
      })
    );
  });

  it("returns null when Supabase env is incomplete", () => {
    expect(createSupabasePushSubscriptionDriverFromEnv({}, vi.fn())).toBeNull();
  });
});
