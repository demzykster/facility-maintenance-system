import { describe, expect, it } from "vitest";
import { isRateLimited, storedRateLimitTimestamp } from "../src/localRateLimitModel.js";

describe("local rate limit model", () => {
  it("reads timestamps returned directly by the app store", () => {
    expect(storedRateLimitTimestamp("1000")).toBe(1000);
  });

  it("keeps compatibility with legacy storage value wrappers", () => {
    expect(storedRateLimitTimestamp({ value: "2000" })).toBe(2000);
  });

  it("treats invalid timestamps as not limited", () => {
    expect(storedRateLimitTimestamp("bad")).toBe(0);
    expect(isRateLimited("bad", 5000)).toBe(false);
  });

  it("detects reports inside the local rate limit window", () => {
    expect(isRateLimited("1000", 3000, 45000)).toBe(true);
    expect(isRateLimited("1000", 50000, 45000)).toBe(false);
  });
});
