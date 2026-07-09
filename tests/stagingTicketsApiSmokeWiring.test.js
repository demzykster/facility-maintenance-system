import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const stagingGate = readFileSync(new URL("../tools/staging-gate.mjs", import.meta.url), "utf8");
const smokeScript = readFileSync(new URL("../tools/staging-tickets-api-smoke.mjs", import.meta.url), "utf8");

describe("staging tickets API smoke wiring", () => {
  it("exposes the normalized ticket API smoke as a package script and includes it in staging gate", () => {
    expect(packageJson.scripts["staging:smoke:tickets-api"]).toBe("node tools/staging-tickets-api-smoke.mjs");
    expect(stagingGate).toContain('"staging:smoke:tickets-api"');
  });

  it("creates and deletes a temporary normalized ticket through the public API", () => {
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/tickets`');
    expect(smokeScript).toContain('fetch(`${publicUrl}/api/tickets?id=${encodeURIComponent(id)}`');
    expect(smokeScript).toContain("tickets_upsert_row_count");
    expect(smokeScript).toContain("tickets_delete_row_count");
    expect(smokeScript).not.toContain('createdBy: { id: "staging-smoke"');
  });
});
