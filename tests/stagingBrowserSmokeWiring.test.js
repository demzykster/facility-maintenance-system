import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const smokeScript = readFileSync(new URL("../tools/staging-browser-smoke.mjs", import.meta.url), "utf8");

describe("staging browser smoke wiring", () => {
  it("checks the current login shell instead of a retired email placeholder", () => {
    expect(smokeScript).toContain(".login-card");
    expect(smokeScript).toContain("input.ltr-input");
    expect(smokeScript).not.toContain("owner@example.com");
  });
});
