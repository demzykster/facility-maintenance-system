import { describe, expect, it } from "vitest";
import { resolveTechnicianTolerances } from "../src/technicianToleranceModel.js";

describe("resolveTechnicianTolerances", () => {
  it("uses technician overrides before global defaults", () => {
    expect(resolveTechnicianTolerances(
      { lateTolerance: 12, earlyTolerance: 4 },
      { lateTolerance: 8, earlyTolerance: 2 }
    )).toEqual({ lateTolerance: 12, earlyTolerance: 4 });
  });

  it("falls back to global defaults and then zero", () => {
    expect(resolveTechnicianTolerances({}, { lateTolerance: 8 })).toEqual({
      lateTolerance: 8,
      earlyTolerance: 0
    });
  });

  it("keeps explicit zero overrides", () => {
    expect(resolveTechnicianTolerances(
      { lateTolerance: 0, earlyTolerance: 0 },
      { lateTolerance: 8, earlyTolerance: 2 }
    )).toEqual({ lateTolerance: 0, earlyTolerance: 0 });
  });

  it("ignores invalid or negative values safely", () => {
    expect(resolveTechnicianTolerances(
      { lateTolerance: "bad", earlyTolerance: -5 },
      { lateTolerance: "7", earlyTolerance: 3 }
    )).toEqual({ lateTolerance: 7, earlyTolerance: 3 });
  });
});
