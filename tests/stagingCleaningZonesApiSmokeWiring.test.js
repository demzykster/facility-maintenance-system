import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const gate = readFileSync(new URL("../tools/staging-gate.mjs", import.meta.url), "utf8");

describe("staging cleaning zones API smoke wiring", () => {
  it("keeps the cleaning zones API smoke in the production staging gate", () => {
    const smokeScript = readFileSync("tools/staging-cleaning-zones-api-smoke.mjs", "utf8");

    expect(pkg.scripts["staging:smoke:cleaning-zones-api"]).toBe("node tools/staging-cleaning-zones-api-smoke.mjs");
    expect(gate).toContain('["staging:smoke:cleaning-zones-api", ["npm", ["run", "staging:smoke:cleaning-zones-api"]]]');
    expect(smokeScript).toContain("rest/v1/cleaning_zones");
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/cleaning/zones`');
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/cleaning/zones?id=${encodeURIComponent(id)}`');
  });
});
