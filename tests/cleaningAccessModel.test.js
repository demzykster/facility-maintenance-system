import { describe, expect, it } from "vitest";
import {
  canCloseCleaningComplaints,
  canManageCleaningZones,
  canPerformCleaning,
  canReceiveCleaningComplaints,
  canViewCleaningReports,
  hasCleaningAccess,
  isLegacyCleanerRole,
  isWorkerLike,
  normalizeCleaningAccess
} from "../src/cleaningAccessModel.js";

describe("cleaning access model", () => {
  it("keeps legacy cleaner role compatible during transition", () => {
    const user = { role: "cleaner", active: true };

    expect(isLegacyCleanerRole(user)).toBe(true);
    expect(isWorkerLike(user)).toBe(true);
    expect(hasCleaningAccess(user)).toBe(true);
    expect(canPerformCleaning(user)).toBe(true);
    expect(canReceiveCleaningComplaints(user)).toBe(true);
    expect(canCloseCleaningComplaints(user)).toBe(true);
    expect(normalizeCleaningAccess(user).source).toBe("legacy-role");
  });

  it("treats cleaning workers as workers with cleaning access", () => {
    const user = {
      role: "worker",
      employmentType: "contractor",
      contractorName: "CleanCo",
      cleaningAccess: true
    };

    expect(isWorkerLike(user)).toBe(true);
    expect(hasCleaningAccess(user)).toBe(true);
    expect(canPerformCleaning(user)).toBe(true);
    expect(canReceiveCleaningComplaints(user)).toBe(true);
    expect(canCloseCleaningComplaints(user)).toBe(true);
    expect(canManageCleaningZones(user)).toBe(false);
    expect(canViewCleaningReports(user)).toBe(false);
  });

  it("treats workers in the cleaning department as cleaning-capable", () => {
    const user = { role: "worker", dept: "ניקיון" };

    expect(normalizeCleaningAccess(user)).toMatchObject({
      enabled: true,
      canPerformRounds: true,
      canReceiveComplaints: true,
      canCloseComplaints: true,
      source: "department"
    });
    expect(canPerformCleaning(user)).toBe(true);
  });

  it("supports cleaning department through worker department lists", () => {
    expect(canPerformCleaning({ role: "worker", depts: ["מחסן", "ניקיון"] })).toBe(true);
  });

  it("supports server session department fields for cleaning workers", () => {
    expect(canPerformCleaning({ role: "worker", department: "ניקיון" })).toBe(true);
    expect(canPerformCleaning({ role: "worker", departments: ["מחסן", "ניקיון"] })).toBe(true);
  });

  it("does not grant cleaning access just because a manager owns the cleaning department", () => {
    expect(canPerformCleaning({ role: "user", dept: "ניקיון" })).toBe(false);
  });

  it("allows capability flags to narrow worker cleaning access", () => {
    const access = normalizeCleaningAccess({
      role: "worker",
      cleaningAccess: {
        enabled: true,
        canPerformRounds: true,
        canReceiveComplaints: true,
        canCloseComplaints: false,
        zoneIds: ["z1", "z1", "", "z2"]
      }
    });

    expect(access).toMatchObject({
      enabled: true,
      canPerformRounds: true,
      canReceiveComplaints: true,
      canCloseComplaints: false,
      zoneIds: ["z1", "z2"]
    });
    expect(canCloseCleaningComplaints({ role: "worker", cleaningAccess: { enabled: true, canCloseComplaints: false } })).toBe(false);
  });

  it("keeps zone management and reports behind management permissions", () => {
    const basicCleaner = { role: "worker", cleaningAccess: true };
    const cleaningManager = { role: "user", perms: { cleaning: "manage" } };
    const analyticsViewer = { role: "user", perms: { analytics: "view" } };

    expect(canManageCleaningZones(basicCleaner)).toBe(false);
    expect(canViewCleaningReports(basicCleaner)).toBe(false);
    expect(canManageCleaningZones(cleaningManager)).toBe(true);
    expect(canViewCleaningReports(cleaningManager)).toBe(true);
    expect(canManageCleaningZones(analyticsViewer)).toBe(false);
    expect(canViewCleaningReports(analyticsViewer)).toBe(true);
  });

  it("disables cleaning worker access for inactive users", () => {
    const user = { role: "worker", active: false, cleaningAccess: true };

    expect(hasCleaningAccess(user)).toBe(false);
    expect(canPerformCleaning(user)).toBe(false);
    expect(canReceiveCleaningComplaints(user)).toBe(false);
  });

  it("keeps admin able to manage and inspect cleaning even without worker access", () => {
    const admin = { role: "admin" };

    expect(hasCleaningAccess(admin)).toBe(false);
    expect(canPerformCleaning(admin)).toBe(true);
    expect(canManageCleaningZones(admin)).toBe(true);
    expect(canViewCleaningReports(admin)).toBe(true);
  });
});
