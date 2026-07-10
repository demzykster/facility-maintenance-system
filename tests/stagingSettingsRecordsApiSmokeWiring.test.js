import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const gate = readFileSync(new URL("../tools/staging-gate.mjs", import.meta.url), "utf8");

describe("staging settings records API smoke wiring", () => {
  it("keeps the settings records API smoke in the production staging gate", () => {
    const smokeScript = readFileSync("tools/staging-settings-records-api-smoke.mjs", "utf8");

    expect(pkg.scripts["staging:smoke:settings-records-api"]).toBe("node tools/staging-settings-records-api-smoke.mjs");
    expect(gate).toContain('["staging:smoke:settings-records-api", ["npm", ["run", "staging:smoke:settings-records-api"]]]');
    expect(smokeScript).toContain("rest/v1/${table}");
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/settings/records`');
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/settings/records?resource=${encodeURIComponent(config.resource)}`');
  });

  it("reconciles location and app issue KV records into normalized settings tables through the public API", () => {
    const reconcileScript = readFileSync("tools/staging-settings-records-reconcile.mjs", "utf8");

    expect(pkg.scripts["staging:settings-records:reconcile"]).toBe("node tools/staging-settings-records-reconcile.mjs");
    expect(gate).toContain('["staging:settings-records:reconcile", ["npm", ["run", "staging:settings-records:reconcile"]]]');
    expect(reconcileScript).toContain('prefix: "location:"');
    expect(reconcileScript).toContain('table: "app_issue_reports"');
    expect(reconcileScript).toContain('fetch(`${publicUrl}/api/settings/records`');
  });
});
