import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const gate = readFileSync(new URL("../tools/staging-gate.mjs", import.meta.url), "utf8");

describe("staging PM API smoke wiring", () => {
  it("keeps PM reconcile and API smoke in the production staging gate", () => {
    expect(pkg.scripts["staging:pm:reconcile"]).toBe("node tools/staging-pm-reconcile.mjs");
    expect(pkg.scripts["staging:smoke:pm-api"]).toBe("node tools/staging-pm-api-smoke.mjs");
    expect(gate).toContain('["staging:pm:reconcile", ["npm", ["run", "staging:pm:reconcile"]]]');
    expect(gate).toContain('["staging:smoke:pm-api", ["npm", ["run", "staging:smoke:pm-api"]]]');
  });
});
