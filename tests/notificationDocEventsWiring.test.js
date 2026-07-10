import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("notification document event wiring", () => {
  it("keeps fleet document notification timestamps stable instead of recomputing from Date.now", () => {
    expect(source).toContain("function docNotificationAt");
    expect(source).toMatch(/key: "doc-" \+ f\.id, at: docNotificationAt\(f, cfg, s\), kind: "doc"/);
    expect(source).not.toMatch(/key: "doc-" \+ f\.id, at: Date\.now\(\)/);
  });
});
