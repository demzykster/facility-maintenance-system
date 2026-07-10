import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const script = readFileSync(new URL("../tools/staging-smoke-preflight-ci.mjs", import.meta.url), "utf8");

describe("staging preflight CI wiring", () => {
  it("runs a CI-safe staging preflight contract in GitHub Actions", () => {
    expect(pkg.scripts["staging:preflight:ci"]).toBe("node tools/staging-smoke-preflight-ci.mjs");
    expect(ci).toContain("Run staging preflight contract");
    expect(ci).toContain("npm run staging:preflight:ci");
    expect(script).toContain("stagingSmokePreflightEnvErrors");
    expect(script).toContain("productionConfigGate");
    expect(script).toContain("https://ci-preflight.supabase.co");
  });
});
