import { describe, expect, it } from "vitest";
import { kvMirrorRetirementPlan } from "../src/kvMirrorRetirementModel.js";

describe("KV mirror retirement model", () => {
  it("marks only shared KV rows with matching normalized source_kv_key as retirable", () => {
    expect(kvMirrorRetirementPlan({
      prefix: "presence:",
      kvRows: [
        { scope: "shared", record_key: "presence:user-1", value: "{}" },
        { scope: "shared", record_key: "presence:user-2", value: "{}" },
        { scope: "local", record_key: "presence:user-3", value: "{}" },
        { scope: "shared", record_key: "ticket:T-1", value: "{}" }
      ],
      normalizedRows: [
        { id: "user-1", source_kv_key: "presence:user-1" },
        { id: "other", source_kv_key: "ticket:T-1" }
      ]
    })).toEqual({
      prefix: "presence:",
      counts: {
        kv: 3,
        normalizedSourceKeys: 2,
        matched: 1,
        notMatched: 1,
        notShared: 1
      },
      matched: ["presence:user-1"],
      notMatched: ["presence:user-2"],
      notShared: [{ scope: "local", recordKey: "presence:user-3" }]
    });
  });
});
