import { describe, expect, it } from "vitest";
import {
  isExpectedBrowserSmokeResponse,
  isGenericLoadResourceConsoleError,
  isRelevantBrowserSmokeConsoleMessage
} from "../src/stagingBrowserSignalModel.js";

describe("staging browser smoke signal filters", () => {
  it("ignores expected auth probe responses while keeping real API failures relevant", () => {
    expect(isExpectedBrowserSmokeResponse({
      status: 404,
      url: "https://facility-maintenance-system.vercel.app/api/session/initial-password"
    })).toBe(true);
    expect(isExpectedBrowserSmokeResponse({
      status: 404,
      url: "https://facility-maintenance-system.vercel.app/api/kv?prefix=ticket"
    })).toBe(false);
  });

  it("lets response filtering own generic browser resource errors", () => {
    expect(isGenericLoadResourceConsoleError("Failed to load resource: the server responded with a status of 404 ()")).toBe(true);
    expect(isRelevantBrowserSmokeConsoleMessage({
      type: "error",
      text: "Failed to load resource: the server responded with a status of 404 ()"
    })).toBe(false);
    expect(isRelevantBrowserSmokeConsoleMessage({
      type: "error",
      text: "Uncaught TypeError: boom"
    })).toBe(true);
  });
});
