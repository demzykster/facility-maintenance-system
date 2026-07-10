import { describe, expect, it } from "vitest";
import { appConfigMirrorRetirementPlan } from "../src/appConfigMirrorRetirementModel.js";

describe("app config mirror retirement model", () => {
  it("allows deleting shared config:v1 when normalized config matches", () => {
    expect(appConfigMirrorRetirementPlan({
      kvRow: { scope: "shared", record_key: "config:v1", value: "{\"departments\":[\"Ops\"],\"companyName\":\"CDSL\"}" },
      normalizedRow: { config: { companyName: "CDSL", departments: ["Ops"] } }
    })).toEqual({
      key: "config:v1",
      canDelete: true,
      counts: { kv: 1, normalized: 1, matched: 1 }
    });
  });

  it("blocks deletion when normalized config is missing or different", () => {
    expect(appConfigMirrorRetirementPlan({
      kvRow: { scope: "shared", record_key: "config:v1", value: "{\"companyName\":\"CDSL\"}" },
      normalizedRow: null
    })).toMatchObject({ canDelete: false, counts: { normalized: 0, matched: 0 } });

    expect(appConfigMirrorRetirementPlan({
      kvRow: { scope: "shared", record_key: "config:v1", value: "{\"companyName\":\"CDSL\"}" },
      normalizedRow: { config: { companyName: "Other" } }
    })).toMatchObject({ canDelete: false, counts: { matched: 0 } });
  });

  it("does not delete absent or non-shared mirrors", () => {
    expect(appConfigMirrorRetirementPlan({
      normalizedRow: { config: { companyName: "CDSL" } }
    })).toMatchObject({ canDelete: false, counts: { kv: 0 } });

    expect(appConfigMirrorRetirementPlan({
      kvRow: { scope: "local", record_key: "config:v1", value: "{\"companyName\":\"CDSL\"}" },
      normalizedRow: { config: { companyName: "CDSL" } }
    })).toMatchObject({ canDelete: false });
  });
});
