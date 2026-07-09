import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const gate = readFileSync(new URL("../tools/staging-gate.mjs", import.meta.url), "utf8");

describe("staging cleaning rounds API smoke wiring", () => {
  it("keeps cleaning rounds reconcile and API smoke in the production staging gate", () => {
    const reconcileScript = readFileSync("tools/staging-cleaning-rounds-reconcile.mjs", "utf8");
    const smokeScript = readFileSync("tools/staging-cleaning-rounds-api-smoke.mjs", "utf8");

    expect(pkg.scripts["staging:cleaning-rounds:reconcile"]).toBe("node tools/staging-cleaning-rounds-reconcile.mjs");
    expect(pkg.scripts["staging:smoke:cleaning-rounds-api"]).toBe("node tools/staging-cleaning-rounds-api-smoke.mjs");
    expect(gate).toContain('["staging:cleaning-rounds:reconcile", ["npm", ["run", "staging:cleaning-rounds:reconcile"]]]');
    expect(gate).toContain('["staging:smoke:cleaning-rounds-api", ["npm", ["run", "staging:smoke:cleaning-rounds-api"]]]');
    expect(reconcileScript).toContain("prefix=cround%3A");
    expect(reconcileScript).toContain("rest/v1/cleaning_rounds");
    expect(reconcileScript).toContain('fetch(`${publicUrl}/api/cleaning/rounds`');
    expect(smokeScript).toContain('table: "cleaning_rounds"');
    expect(smokeScript).toContain("/api/cleaning/rounds");
  });
});
