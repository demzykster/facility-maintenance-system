import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LOAD_TEST_THRESHOLDS,
  createLoadTestRunId,
  isLoadTestId,
  loadTestBatch,
  loadTestRecordId,
  normalizeLoadTestProfile,
  percentile,
  summarizeLoadTimings
} from "../src/stagingLoadTestModel.js";

describe("staging load test model", () => {
  it("normalizes known profiles with explicit non-negative overrides", () => {
    expect(normalizeLoadTestProfile("pilot")).toMatchObject({ tickets: 1000, tasks: 1000, fleet: 250 });
    expect(normalizeLoadTestProfile("unknown", { tickets: 3, tasks: -1, meetings: "" })).toMatchObject({
      tickets: 3,
      tasks: 25,
      meetings: 5
    });
  });

  it("creates and recognizes scoped load-test ids only", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456);
    const runId = createLoadTestRunId(123);
    expect(runId).toBe("loadtest-123-4fzyo8");
    expect(loadTestRecordId(runId, "ticket", 7)).toBe("loadtest-123-4fzyo8-ticket-000007");
    expect(isLoadTestId(runId)).toBe(true);
    expect(isLoadTestId("ticket-real-1")).toBe(false);
    expect(() => loadTestRecordId("real-run", "ticket", 1)).toThrow("loadtest_run_id_required");
  });

  it("batches rows for bounded Supabase writes", () => {
    expect(loadTestBatch([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("summarizes timings and threshold failures", () => {
    expect(percentile([10, 20, 30, 40], 95)).toBe(40);
    expect(DEFAULT_LOAD_TEST_THRESHOLDS.apiP95Ms).toBe(1500);
    expect(summarizeLoadTimings([
      { durationMs: 600, status: 200 },
      { durationMs: 900, status: 200 },
      { durationMs: 1200, status: 200 }
    ], DEFAULT_LOAD_TEST_THRESHOLDS)).toMatchObject({
      ok: true,
      thresholdFailures: []
    });
    expect(summarizeLoadTimings([
      { durationMs: 100, status: 200 },
      { durationMs: 200, status: 200 },
      { durationMs: 4000, status: 200 }
    ], DEFAULT_LOAD_TEST_THRESHOLDS)).toMatchObject({
      count: 3,
      failures: 0,
      p95Ms: 4000,
      maxMs: 4000,
      ok: false,
      thresholdFailures: ["api_p95_ms:4000", "api_max_ms:4000"]
    });
  });
});
