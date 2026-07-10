import { describe, expect, it } from "vitest";
import { DEFAULT_DATA_REFRESH_INTERVAL_MS, MIN_DATA_REFRESH_GAP_MS, shouldRunDataRefresh } from "../src/dataRefreshScheduleModel.js";

describe("data refresh schedule model", () => {
  it("uses a calm background interval for authenticated data refresh", () => {
    expect(DEFAULT_DATA_REFRESH_INTERVAL_MS).toBeGreaterThanOrEqual(60_000);
  });

  it("does not start a refresh while another one is in flight", () => {
    expect(shouldRunDataRefresh({ inFlight: true, force: true })).toBe(false);
  });

  it("does not refresh while the app is hidden", () => {
    expect(shouldRunDataRefresh({ hidden: true, force: true })).toBe(false);
  });

  it("allows forced refresh when visible and idle", () => {
    expect(shouldRunDataRefresh({ force: true, hidden: false, inFlight: false })).toBe(true);
  });

  it("requires a minimum gap for normal background refreshes", () => {
    expect(shouldRunDataRefresh({
      now: 10_000,
      lastStartedAt: 10_000 - MIN_DATA_REFRESH_GAP_MS + 1
    })).toBe(false);
    expect(shouldRunDataRefresh({
      now: 10_000,
      lastStartedAt: 10_000 - MIN_DATA_REFRESH_GAP_MS
    })).toBe(true);
  });
});
