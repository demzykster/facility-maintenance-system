import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("staging load test wiring", () => {
  it("exposes the scoped staging load-test command", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts["staging:load:test"]).toBe("node tools/staging-load-test.mjs");
  });

  it("keeps cleanup constrained to loadtest ids", () => {
    const script = readFileSync("tools/staging-load-test.mjs", "utf8");
    expect(script).toContain("unsafe_loadtest_cleanup_run_id");
    expect(script).toContain('startsWith("loadtest-")');
    expect(script).toContain("id=like.");
  });
});
