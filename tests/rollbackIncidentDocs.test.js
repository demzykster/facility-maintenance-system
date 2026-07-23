import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("rollback and incident documentation", () => {
  it("keeps the rollback checklist bounded to approved manual actions", () => {
    const source = readFileSync("docs/rollback-checklist.md", "utf8");

    expect(source).toContain("never restore over production");
    expect(source).toContain("npm run rollback:verify");
    expect(source).toContain("--expected-current-sha");
    expect(source).toContain("--target-sha");
    expect(source).toContain("owner approval");
    expect(source).toContain("migration compatibility");
    expect(source).not.toMatch(/auto-?rollback/i);
  });

  it("documents incident response without inventing contacts or mutation authority", () => {
    const source = readFileSync("docs/incident-response-runbook.md", "utf8");

    expect(source).toContain("SEV1");
    expect(source).toContain("/api/health");
    expect(source).toContain("/cmms-version.json");
    expect(source).toContain("/api/system-errors");
    expect(source).toContain("ROLLBACK_UNSAFE");
    expect(source).toContain("Do not run `vercel rollback`");
    expect(source).toContain("Do not restore over production");
    expect(source).not.toMatch(/call\s+\+?\d/i);
    expect(source).not.toMatch(/slack\s+channel:\s*#/i);
  });
});
