import { describe, expect, it } from "vitest";
import { canDeleteCleaningZone, cleaningZoneBlockerCount, cleaningZoneDeleteBlockers } from "../src/cleaningZoneBlockersModel.js";

describe("cleaningZoneDeleteBlockers", () => {
  it("returns empty blockers for a missing zone id", () => {
    expect(cleaningZoneDeleteBlockers("", {
      rounds: [{ id: "r1", zoneId: "z1" }],
      complaints: [{ id: "c1", zoneId: "z1" }],
      users: [{ id: "u1", mgrZones: ["z1"] }]
    })).toEqual({ rounds: [], complaints: [], managers: [] });
  });

  it("finds only records linked to the selected zone", () => {
    const blockers = cleaningZoneDeleteBlockers("z1", {
      rounds: [{ id: "r1", zoneId: "z1" }, { id: "r2", zoneId: "z2" }],
      complaints: [{ id: "c1", zoneId: "z1" }, { id: "c2", zoneId: "z3" }],
      users: [{ id: "u1", mgrZones: ["z2"] }, { id: "u2", mgrZones: ["z1"] }]
    });

    expect(blockers.rounds.map((round) => round.id)).toEqual(["r1"]);
    expect(blockers.complaints.map((complaint) => complaint.id)).toEqual(["c1"]);
    expect(blockers.managers.map((manager) => manager.id)).toEqual(["u2"]);
    expect(cleaningZoneBlockerCount(blockers)).toBe(3);
  });

  it("allows delete only when there are no linked records", () => {
    expect(canDeleteCleaningZone("z1", { rounds: [], complaints: [], users: [] })).toBe(true);
    expect(canDeleteCleaningZone("z1", { rounds: [{ id: "r1", zoneId: "z1" }], complaints: [], users: [] })).toBe(false);
  });
});
