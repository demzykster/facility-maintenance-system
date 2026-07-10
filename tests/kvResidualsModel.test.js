import { describe, expect, it } from "vitest";
import { classifyKvResiduals, countKvPrefixes, prefixFromRecordKey } from "../src/kvResidualsModel.js";

describe("kv residuals model", () => {
  it("extracts and counts KV prefixes", () => {
    expect(prefixFromRecordKey("user:worker-1")).toBe("user");
    expect(prefixFromRecordKey("config:v1")).toBe("config");
    expect(countKvPrefixes(["user:1", "user:2", "ticket:t1", ""])).toEqual({
      ticket: 1,
      user: 2
    });
  });

  it("classifies compatibility mirrors, transient keys, deferred candidates, and unknown prefixes", () => {
    const report = classifyKvResiduals({
      kvPrefixes: {
        user: 12,
        ticket: 1,
        publicComplaintRate: 2,
        controlProgram: 1,
        itpl: 1,
        mystery: 3
      },
      userReconciliation: {
        counts: { legacyUsers: 12, matched: 12 }
      }
    });

    expect(report.counts).toEqual({
      prefixes: 6,
      compatibilityMirrors: 13,
      transientOperational: 2,
      deferredOrphanCandidates: 2,
      unknown: 3
    });
    expect(report.compatibilityMirrors).toEqual([
      { prefix: "ticket", count: 1, status: "compatibility_mirror" },
      { prefix: "user", count: 12, status: "matched:12/12" }
    ]);
    expect(report.transientOperational).toEqual([{ prefix: "publicComplaintRate", count: 2, status: "transient_operational" }]);
    expect(report.deferredOrphanCandidates).toEqual([
      { prefix: "controlProgram", count: 1, status: "deferred_or_orphan_candidate" },
      { prefix: "itpl", count: 1, status: "deferred_or_orphan_candidate" }
    ]);
    expect(report.unknown).toEqual([{ prefix: "mystery", count: 3, status: "unknown" }]);
  });
});
