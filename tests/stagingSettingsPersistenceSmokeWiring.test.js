import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const smokeScript = readFileSync(new URL("../tools/staging-settings-persistence-smoke.mjs", import.meta.url), "utf8");
const gateScript = readFileSync(new URL("../tools/staging-gate.mjs", import.meta.url), "utf8");

describe("staging settings persistence smoke wiring", () => {
  it("keeps settings smoke focused on app config persistence", () => {
    expect(smokeScript).toContain("/api/settings/config");
    expect(smokeScript).not.toContain("mtask:");
    expect(smokeScript).not.toContain("ppeitem:");
    expect(smokeScript).not.toContain("czone:");
  });

  it("keeps normalized domain persistence covered by dedicated gate smokes", () => {
    expect(gateScript).toContain('["staging:smoke:work-records-api", ["npm", ["run", "staging:smoke:work-records-api"]]]');
    expect(gateScript).toContain('["staging:smoke:ppe-api", ["npm", ["run", "staging:smoke:ppe-api"]]]');
    expect(gateScript).toContain('["staging:smoke:cleaning-zones-api", ["npm", ["run", "staging:smoke:cleaning-zones-api"]]]');
  });
});
