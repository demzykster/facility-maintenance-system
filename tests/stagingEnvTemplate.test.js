import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGING_SMOKE_OPTIONAL_ENV, STAGING_SMOKE_REQUIRED_ENV } from "../src/stagingSmokePreflightModel.js";

const template = readFileSync(new URL("../.env.staging.example", import.meta.url), "utf8");

function templateEnvNames(text) {
  return new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("=")[0].trim())
      .filter(Boolean)
  );
}

describe("staging env template", () => {
  it("documents every env checked by staging smoke preflight", () => {
    const names = templateEnvNames(template);
    expect([...STAGING_SMOKE_REQUIRED_ENV, ...STAGING_SMOKE_OPTIONAL_ENV].filter((name) => !names.has(name))).toEqual([]);
  });

  it("keeps bootstrap env commented because it must be temporary", () => {
    const names = templateEnvNames(template);
    expect(names.has("CMMS_BOOTSTRAP_ENABLED")).toBe(false);
    expect(names.has("CMMS_BOOTSTRAP_TOKEN")).toBe(false);
    expect(template).toContain("# CMMS_BOOTSTRAP_ENABLED=true");
    expect(template).toContain("# CMMS_BOOTSTRAP_TOKEN=REPLACE_WITH_ONE_TIME_RANDOM_TOKEN");
  });
});
