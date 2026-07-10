import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const script = readFileSync(new URL("../tools/static-syntax-check.mjs", import.meta.url), "utf8");

describe("static syntax gate wiring", () => {
  it("runs the syntax gate in CI without adding broad formatting churn", () => {
    expect(pkg.scripts.lint).toBe("node tools/static-syntax-check.mjs");
    expect(ci).toContain("Run static syntax check");
    expect(ci).toContain("npm run lint");
    expect(script).toContain("node:child_process");
    expect(script).toContain("--check");
    expect(script).toContain("CHECK_EXTENSIONS");
  });
});
