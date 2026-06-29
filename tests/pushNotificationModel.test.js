import { describe, expect, it } from "vitest";
import {
  parsePushSubscriptions,
  pushPayload,
  pushRuntimeReady,
  removePushSubscription,
  upsertPushSubscription
} from "../src/pushNotificationModel.js";

const subscription = {
  endpoint: "https://push.example/device/1",
  keys: { p256dh: "p256", auth: "auth" }
};

describe("push notification model", () => {
  it("requires all VAPID env pieces before enabling server push", () => {
    expect(pushRuntimeReady({})).toBe(false);
    expect(pushRuntimeReady({
      CMMS_PUSH_VAPID_PUBLIC_KEY: "pub",
      CMMS_PUSH_VAPID_PRIVATE_KEY: "priv",
      CMMS_PUSH_CONTACT: "mailto:owner@example.com"
    })).toBe(true);
  });

  it("upserts one subscription per endpoint and preserves user metadata", () => {
    const first = upsertPushSubscription([], subscription, { id: "u1", name: "Vadim", role: "admin" }, 100);
    const second = upsertPushSubscription(first.list, subscription, { id: "u1", name: "Vadim", role: "admin" }, 200);

    expect(second.ok).toBe(true);
    expect(second.list).toHaveLength(1);
    expect(second.list[0]).toMatchObject({
      userId: "u1",
      userName: "Vadim",
      userRole: "admin",
      createdAt: 100,
      updatedAt: 200,
      subscription
    });
  });

  it("parses and removes stored subscriptions safely", () => {
    const stored = upsertPushSubscription([], subscription, { id: "u1" }, 100).list;

    expect(parsePushSubscriptions(JSON.stringify(stored))).toHaveLength(1);
    expect(removePushSubscription(stored, subscription)).toEqual([]);
    expect(parsePushSubscriptions("not-json")).toEqual([]);
  });

  it("builds a compact notification payload", () => {
    expect(JSON.parse(pushPayload({ title: "A", body: "B", url: "/tickets", tag: "t" }))).toEqual({
      title: "A",
      body: "B",
      url: "/tickets",
      tag: "t"
    });
  });
});
