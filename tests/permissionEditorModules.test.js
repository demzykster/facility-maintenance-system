import { describe, expect, it } from "vitest";
import { PERM_LEVELS, USER_PERMISSION_MODULES } from "../src/permissionModel.js";

describe("user permission editor modules", () => {
  it("keeps module keys unique and uses known permission levels", () => {
    const keys = USER_PERMISSION_MODULES.map((m) => m.mod);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(["fleetDocs", "fleetTickets", "ppe", "workerAccess", "users"]);

    for (const mod of USER_PERMISSION_MODULES) {
      expect(mod.levels[0]).toBe("none");
      expect(mod.levels.every((level) => PERM_LEVELS.includes(level))).toBe(true);
    }
  });
});
