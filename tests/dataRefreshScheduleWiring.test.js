import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/ClaudeMaintenanceApp.jsx", "utf8");

describe("authenticated data refresh schedule wiring", () => {
  it("uses the shared data refresh schedule model", () => {
    expect(source).toContain("DEFAULT_DATA_REFRESH_INTERVAL_MS");
    expect(source).toContain("shouldRunDataRefresh({");
  });

  it("guards background refreshes against overlap", () => {
    expect(source).toContain("dataRefreshInFlightRef");
    expect(source).toMatch(/inFlight:\s*dataRefreshInFlightRef\.current/);
    expect(source).toMatch(/finally\(\(\) => \{ dataRefreshInFlightRef\.current = false; \}\)/);
  });

  it("does not restore the old aggressive 15-second polling interval", () => {
    expect(source).not.toContain("setInterval(refresh, 15000)");
    expect(source).toContain("setInterval(refresh, DEFAULT_DATA_REFRESH_INTERVAL_MS)");
  });
});
