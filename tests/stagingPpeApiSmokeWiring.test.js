import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const gate = readFileSync(new URL("../tools/staging-gate.mjs", import.meta.url), "utf8");

describe("staging PPE API smoke wiring", () => {
  it("keeps the PPE API smoke in the production staging gate", () => {
    const smokeScript = readFileSync("tools/staging-ppe-api-smoke.mjs", "utf8");

    expect(pkg.scripts["staging:smoke:ppe-api"]).toBe("node tools/staging-ppe-api-smoke.mjs");
    expect(gate).toContain('["staging:smoke:ppe-api", ["npm", ["run", "staging:smoke:ppe-api"]]]');
    expect(smokeScript).toContain("rest/v1/${table}");
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/ppe`');
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/ppe?resource=${encodeURIComponent(config.resource)}`');
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/ppe?resource=${encodeURIComponent(config.resource)}&id=${encodeURIComponent(config.id)}`');
  });

  it("reconciles PPE KV records into normalized PPE tables through the public API", () => {
    const reconcileScript = readFileSync("tools/staging-ppe-reconcile.mjs", "utf8");

    expect(pkg.scripts["staging:ppe:reconcile"]).toBe("node tools/staging-ppe-reconcile.mjs");
    expect(gate).toContain('["staging:ppe:reconcile", ["npm", ["run", "staging:ppe:reconcile"]]]');
    expect(reconcileScript).toContain('prefix: "ppeitem:"');
    expect(reconcileScript).toContain('table: "ppe_requests"');
    expect(reconcileScript).toContain('fetch(`${publicUrl}/api/ppe`');
  });
});
