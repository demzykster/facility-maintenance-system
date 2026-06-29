import { describe, expect, it } from "vitest";
import {
  notificationAllowedByAccess,
  notificationEnabledForUser,
  normalizeNotificationPrefs
} from "../src/notificationAccessModel.js";

describe("notification access model", () => {
  it("keeps role-based operational notifications working without duplicate module flags", () => {
    expect(notificationAllowedByAccess({ role: "cleaner" }, "cleaning")).toBe(true);
    expect(notificationAllowedByAccess({ role: "tech" }, "new")).toBe(true);
    expect(notificationAllowedByAccess({ role: "user" }, "driver")).toBe(true);
  });

  it("uses module permissions for cross-role access", () => {
    expect(notificationAllowedByAccess({ role: "worker", perms: { ppe: "request" } }, "ppe")).toBe(true);
    expect(notificationAllowedByAccess({ role: "worker", perms: { ppe: "none" } }, "ppe")).toBe(false);
    expect(notificationAllowedByAccess({ role: "user", perms: { analytics: "view" } }, "sla")).toBe(true);
    expect(notificationAllowedByAccess({ role: "user", perms: {} }, "sla")).toBe(false);
  });

  it("lets individual preferences disable a notification kind after access is allowed", () => {
    const user = { role: "cleaner", notificationPrefs: { enabled: { cleaning: false } } };

    expect(notificationEnabledForUser(user, "cleaning")).toBe(false);
    expect(notificationEnabledForUser({ ...user, notificationPrefs: { enabled: { cleaning: true } } }, "cleaning")).toBe(true);
  });

  it("normalizes only known boolean preference values", () => {
    expect(normalizeNotificationPrefs({ enabled: { cleaning: false, unknown: false, ppe: "no" } })).toEqual({
      enabled: { cleaning: false }
    });
  });
});
