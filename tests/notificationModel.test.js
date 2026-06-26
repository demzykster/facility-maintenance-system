import { describe, expect, it } from "vitest";
import { DEFAULT_NOTIFY_CONFIG, NOTIFICATION_KIND_IDS, notificationConfigHasAllKinds } from "../src/notificationModel.js";

describe("notification model", () => {
  it("enables every known notification kind by default", () => {
    expect(Object.keys(DEFAULT_NOTIFY_CONFIG).sort()).toEqual([...NOTIFICATION_KIND_IDS].sort());
    expect(Object.values(DEFAULT_NOTIFY_CONFIG).every(Boolean)).toBe(true);
  });

  it("detects missing notification kinds in a config object", () => {
    const { cleaning, ...withoutCleaning } = DEFAULT_NOTIFY_CONFIG;

    expect(notificationConfigHasAllKinds(DEFAULT_NOTIFY_CONFIG)).toBe(true);
    expect(notificationConfigHasAllKinds(withoutCleaning)).toBe(false);
    expect(cleaning).toBe(true);
  });
});
