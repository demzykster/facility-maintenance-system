import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/ClaudeMaintenanceApp.jsx", "utf8");

describe("startup data-load wiring", () => {
  it("builds the startup KV sweep from normalized authority flags", () => {
    expect(source).toContain("startupKvPrefixesForAuthorities({");
    expect(source).toContain("tickets: NORMALIZED_TICKET_AUTHORITY");
    expect(source).toContain("users: USER_MANAGEMENT_API_AUTHORITY");
    expect(source).toContain("ppe: NORMALIZED_PPE_AUTHORITY");
  });

  it("does not call shared KV collection loading for an empty startup plan", () => {
    expect(source).toMatch(/async function loadCollections\(prefixes\) \{\s*if \(!prefixes\.length\) return \[\];/);
  });

  it("loads normalized startup domains in parallel before applying state", () => {
    expect(source).toContain("const normalizedLoads = [];");
    expect(source).toMatch(/normalizedLoads\.push\(\(async \(\) => \{[\s\S]*ticketsForAuthority/);
    expect(source).toMatch(/normalizedLoads\.push\(\(async \(\) => \{[\s\S]*ppeForAuthority/);
    expect(source).toMatch(/await Promise\.all\(normalizedLoads\);[\s\S]*const apply =/);
  });
});
