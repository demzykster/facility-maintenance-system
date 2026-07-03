import { describe, expect, it } from "vitest";
import {
  parsePushSubscriptions,
  pushPayload,
  pushRuntimeReady,
  normalizePushNotificationRequest,
  removePushSubscription,
  selectPushNotificationTargets,
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
    const first = upsertPushSubscription([], subscription, { id: "u1", name: "Vadim", role: "admin", perms: { settings: "full" }, notificationPrefs: { enabled: { sla: false } } }, 100);
    const second = upsertPushSubscription(first.list, subscription, { id: "u1", name: "Vadim", role: "admin", perms: { settings: "full" }, notificationPrefs: { enabled: { sla: false } } }, 200);

    expect(second.ok).toBe(true);
    expect(second.list).toHaveLength(1);
    expect(second.list[0]).toMatchObject({
      userId: "u1",
      userName: "Vadim",
      userRole: "admin",
      userPermissions: { settings: "full" },
      notificationPrefs: { enabled: { sla: false } },
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

  it("normalizes phone notification requests to explicit safe targets", () => {
    expect(normalizePushNotificationRequest({ title: "A", body: "B", targetUserIds: ["u1", "u1"], url: "https://bad.example" })).toMatchObject({
      ok: true,
      targetUserIds: ["u1"],
      url: "/"
    });
    expect(normalizePushNotificationRequest({ title: "A", body: "B", targetUserIds: [] })).toEqual({
      ok: false,
      error: "push_targets_required"
    });
  });

  it("selects only subscribed target users and de-dupes endpoints", () => {
    const list = [
      ...upsertPushSubscription([], subscription, { id: "u1" }, 100).list,
      ...upsertPushSubscription([], { ...subscription, endpoint: "https://push.example/device/2" }, { id: "u2" }, 100).list
    ];

    expect(selectPushNotificationTargets(list, ["u2"]).map((item) => item.userId)).toEqual(["u2"]);
  });

  it("filters push targets by access and individual notification preferences", () => {
    const list = [
      ...upsertPushSubscription([], subscription, { id: "cleaner", role: "cleaner", notificationPrefs: { enabled: { cleaning: false } } }, 100).list,
      ...upsertPushSubscription([], { ...subscription, endpoint: "https://push.example/device/2" }, { id: "worker", role: "worker" }, 100).list,
      ...upsertPushSubscription([], { ...subscription, endpoint: "https://push.example/device/3" }, { id: "ppe", role: "worker", perms: { ppe: "request" } }, 100).list
    ];

    expect(selectPushNotificationTargets(list, ["cleaner"], "cleaning")).toEqual([]);
    expect(selectPushNotificationTargets(list, ["worker"], "sla")).toEqual([]);
    expect(selectPushNotificationTargets(list, ["ppe"], "ppe").map((item) => item.userId)).toEqual(["ppe"]);
  });
});
