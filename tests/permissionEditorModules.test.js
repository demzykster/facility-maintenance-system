import { describe, expect, it } from "vitest";
import { DEFAULT_MANAGER_PERMS, PERM_LEVELS, USER_PERMISSION_MODULES } from "../src/permissionModel.js";

describe("user permission editor modules", () => {
  it("keeps module keys unique and uses known permission levels", () => {
    const keys = USER_PERMISSION_MODULES.map((m) => m.mod);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(["fleetDocs", "fleetTickets", "ppe", "workerAccess", "users", "analytics", "suppliers", "settings", "audit"]);

    for (const mod of USER_PERMISSION_MODULES) {
      expect(mod.levels[0]).toBe("none");
      expect(mod.levels.every((level) => PERM_LEVELS.includes(level))).toBe(true);
    }
  });

  it("keeps the new-manager permission preset aligned with the editor modules", () => {
    expect(DEFAULT_MANAGER_PERMS).toEqual({
      fleetTickets: "view",
      ppe: "request",
      users: "view",
      audit: "view"
    });

    const moduleLevels = new Map(USER_PERMISSION_MODULES.map((module) => [module.mod, module.levels]));
    for (const [mod, level] of Object.entries(DEFAULT_MANAGER_PERMS)) {
      expect(moduleLevels.get(mod)).toContain(level);
    }
  });
});
