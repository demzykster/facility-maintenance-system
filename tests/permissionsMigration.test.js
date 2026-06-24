import { describe, expect, it } from "vitest";
import { normalizePerms, permLevel, permRank } from "../src/permissionModel.js";

describe("permission migration bridge", () => {
  it("maps legacy fleet flags into module permissions", () => {
    const legacyUser = {
      role: "user",
      fleetDocs: true,
      fleetTickets: true
    };

    expect(normalizePerms(legacyUser)).toEqual({
      fleetDocs: "view",
      fleetTickets: "view"
    });
    expect(permRank(permLevel(legacyUser, "fleetDocs"))).toBeGreaterThanOrEqual(permRank("view"));
    expect(permRank(permLevel(legacyUser, "fleetTickets"))).toBeGreaterThanOrEqual(permRank("view"));
  });

  it("keeps explicit perms stronger than legacy flags", () => {
    const migratedUser = {
      role: "user",
      fleetDocs: true,
      fleetTickets: true,
      perms: {
        fleetDocs: "none",
        fleetTickets: "manage",
        ppe: "full"
      }
    };

    expect(normalizePerms(migratedUser)).toEqual({
      fleetDocs: "none",
      fleetTickets: "manage",
      ppe: "full"
    });
    expect(permLevel(migratedUser, "fleetDocs")).toBe("none");
    expect(permLevel(migratedUser, "fleetTickets")).toBe("manage");
  });

  it("gives admins full permission through role defaults", () => {
    expect(permLevel({ role: "admin" }, "workerAccess")).toBe("full");
  });
});
