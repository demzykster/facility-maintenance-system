import { describe, expect, it } from "vitest";
import { pushSubscriptionRecordFromSupabaseRow, pushSubscriptionRecordToSupabaseRow } from "../src/pushSubscriptionRecordModel.js";

const subscription = {
  endpoint: "https://push.example/device/1",
  keys: { p256dh: "p256", auth: "auth" }
};

describe("push subscription record model", () => {
  it("normalizes push subscriptions for Supabase rows", () => {
    const row = pushSubscriptionRecordToSupabaseRow({
      userId: "user-1",
      userName: "Owner",
      userRole: "admin",
      subscription,
      createdAt: 1783660000000
    });

    expect(row).toMatchObject({
      id: expect.stringMatching(/^push-/),
      user_id: "user-1",
      user_name: "Owner",
      user_role: "admin",
      endpoint: subscription.endpoint,
      subscription,
      legacy_payload: expect.objectContaining({ userId: "user-1", subscription })
    });
    expect(row.created_at).toBe("2026-07-10T05:06:40.000Z");
  });

  it("restores legacy payloads from Supabase rows", () => {
    const legacy = { id: "push-1", userId: "user-1", subscription };

    expect(pushSubscriptionRecordFromSupabaseRow({
      id: "push-1",
      legacy_payload: legacy
    })).toEqual(legacy);
  });

  it("requires a user and valid subscription", () => {
    expect(() => pushSubscriptionRecordToSupabaseRow({ subscription })).toThrow("push_subscription_user_id_required");
    expect(() => pushSubscriptionRecordToSupabaseRow({ userId: "user-1" })).toThrow("push_subscription_invalid");
  });
});
