import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const gate = readFileSync(new URL("../tools/staging-gate.mjs", import.meta.url), "utf8");

describe("staging work records API smoke wiring", () => {
  it("keeps the work records API smoke in the production staging gate", () => {
    const smokeScript = readFileSync("tools/staging-work-records-api-smoke.mjs", "utf8");

    expect(pkg.scripts["staging:smoke:work-records-api"]).toBe("node tools/staging-work-records-api-smoke.mjs");
    expect(gate).toContain('["staging:smoke:work-records-api", ["npm", ["run", "staging:smoke:work-records-api"]]]');
    expect(smokeScript).toContain("rest/v1/${table}");
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/work`');
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/work?resource=${encodeURIComponent(config.resource)}`');
  });

  it("reconciles task and meeting KV records into normalized work tables through the public API", () => {
    const reconcileScript = readFileSync("tools/staging-work-records-reconcile.mjs", "utf8");

    expect(pkg.scripts["staging:work-records:reconcile"]).toBe("node tools/staging-work-records-reconcile.mjs");
    expect(gate).toContain('["staging:work-records:reconcile", ["npm", ["run", "staging:work-records:reconcile"]]]');
    expect(reconcileScript).toContain('prefix: "mtask:"');
    expect(reconcileScript).toContain('table: "maintenance_meetings"');
    expect(reconcileScript).toContain('fetch(`${publicUrl}/api/work`');
  });
});
