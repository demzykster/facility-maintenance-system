import { describe, expect, it } from "vitest";
import {
  notificationAccessRows,
  notificationAllowedByAccess,
  notificationEnabledForUser,
  normalizeNotificationPrefs
} from "../src/notificationAccessModel.js";

describe("notification access model", () => {
  it("keeps role-based operational notifications working without duplicate module flags", () => {
    expect(notificationAllowedByAccess({ role: "cleaner" }, "cleaning")).toBe(true);
    expect(notificationAllowedByAccess({ role: "worker", cleaningAccess: true }, "cleaning")).toBe(true);
    expect(notificationAllowedByAccess({ role: "worker" }, "cleaning")).toBe(false);
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

  it("builds a visible matrix of allowed, disabled, and blocked notification rows", () => {
    const rows = notificationAccessRows({
      role: "worker",
      perms: { ppe: "request" },
      notificationPrefs: { enabled: { ppe: false } }
    });

    const ppe = rows.find((row) => row.kind === "ppe");
    const sla = rows.find((row) => row.kind === "sla");
    const task = rows.find((row) => row.kind === "task");

    expect(ppe).toMatchObject({ allowed: true, enabled: false, explicitlyDisabled: true });
    expect(sla).toMatchObject({ allowed: false, enabled: false, blockedReason: "אין גישה למודול המתאים" });
    expect(task).toMatchObject({ allowed: true, enabled: true, explicitlyDisabled: false });
  });
});
