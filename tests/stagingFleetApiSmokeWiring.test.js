import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("staging fleet API smoke wiring", () => {
  it("exercises the normalized fleet API and fleet_units table", () => {
    const smokeScript = readFileSync("tools/staging-fleet-api-smoke.mjs", "utf8");

    expect(smokeScript).toContain("rest/v1/fleet_units");
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/fleet`');
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/fleet?id=${encodeURIComponent(id)}`');
  });

  it("reconciles fleet KV records into fleet_units through the public API", () => {
    const reconcileScript = readFileSync("tools/staging-fleet-reconcile.mjs", "utf8");

    expect(reconcileScript).toContain("prefix=fleet%3A");
    expect(reconcileScript).toContain("rest/v1/fleet_units");
    expect(reconcileScript).toContain('fetch(`${publicUrl}/api/fleet`');
  });
});
