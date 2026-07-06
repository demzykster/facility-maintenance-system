import { describe, expect, it } from "vitest";
import {
  cleaningZoneBlockerCount,
  cleaningZoneDeleteBlockers,
  cleaningZoneDeletePlan
} from "../src/cleaningZoneBlockersModel.js";

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

  it("builds a cascade delete plan for the selected zone", () => {
    const plan = cleaningZoneDeletePlan("z1", {
      rounds: [{ id: "r1", zoneId: "z1" }, { id: "r2", zoneId: "z2" }],
      complaints: [{ id: "c1", zoneId: "z1" }, { id: "c2", zoneId: "z3" }],
      users: [
        { id: "u1", name: "Other", mgrZones: ["z2"] },
        { id: "u2", name: "Manager", mgrZones: ["z1", "z2"] }
      ]
    });

    expect(plan.deleteKeys).toEqual(["cround:r1", "ccomplaint:c1", "czone:z1"]);
    expect(plan.updatedManagers).toEqual([{ id: "u2", name: "Manager", mgrZones: ["z2"] }]);
    expect(plan.summary).toEqual({ rounds: 1, complaints: 1, managers: 1 });
  });

  it("does not treat linked history as a delete blocker anymore", () => {
    const blockers = cleaningZoneDeleteBlockers("z1", {
      rounds: [{ id: "r1", zoneId: "z1" }],
      complaints: [{ id: "c1", zoneId: "z1" }],
      users: [{ id: "u1", mgrZones: ["z1"] }]
    });

    expect(cleaningZoneBlockerCount(blockers)).toBe(3);
  });

  it("treats missing blocker details as empty", () => {
    expect(cleaningZoneBlockerCount(null)).toBe(0);
  });
});
