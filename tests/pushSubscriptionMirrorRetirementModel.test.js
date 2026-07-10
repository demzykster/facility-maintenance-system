import { describe, expect, it } from "vitest";
import { pushSubscriptionMirrorRetirementPlan } from "../src/pushSubscriptionMirrorRetirementModel.js";

const legacyValue = JSON.stringify([
  {
    id: "push-1",
    userId: "user-1",
    subscription: {
      endpoint: "https://push.example/1",
      keys: { p256dh: "p256", auth: "auth" }
    }
  }
]);

describe("push subscription mirror retirement model", () => {
  it("allows deleting the shared aggregate mirror when normalized rows cover the legacy JSON", () => {
    expect(pushSubscriptionMirrorRetirementPlan({
      kvRow: { scope: "shared", record_key: "pushSubscriptions:v1", value: legacyValue },
      normalizedRows: [{ id: "push-1" }]
    })).toEqual({
      key: "pushSubscriptions:v1",
      canDelete: true,
      counts: {
        kv: 1,
        kvSubscriptions: 1,
        normalized: 1,
        missingNormalized: 0
      },
      missingNormalizedIds: []
    });
  });

  it("blocks deletion when a legacy subscription is missing from normalized storage", () => {
    expect(pushSubscriptionMirrorRetirementPlan({
      kvRow: { scope: "shared", record_key: "pushSubscriptions:v1", value: legacyValue },
      normalizedRows: []
    })).toMatchObject({
      canDelete: false,
      counts: { missingNormalized: 1 },
      missingNormalizedIds: ["push-1"]
    });
  });

  it("does not delete absent or non-shared mirrors", () => {
    expect(pushSubscriptionMirrorRetirementPlan({ normalizedRows: [{ id: "push-1" }] })).toMatchObject({
      canDelete: false,
      counts: { kv: 0 }
    });
    expect(pushSubscriptionMirrorRetirementPlan({
      kvRow: { scope: "local", record_key: "pushSubscriptions:v1", value: legacyValue },
      normalizedRows: [{ id: "push-1" }]
    })).toMatchObject({ canDelete: false });
  });
});
