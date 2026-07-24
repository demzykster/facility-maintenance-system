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

  it("keeps the production first-run startup flow behind a local cancellation guard", () => {
    expect(source).toMatch(/useEffect\(\(\) => \{\s*let cancelled = false;[\s\S]*fetchFirstRunInstallState/);
    expect(source).toMatch(/fetchFirstRunInstallState[\s\S]*if \(!cancelled\) \{[\s\S]*setFirstRunInstallState\(installState\)/);
    expect(source).toMatch(/restoreProductionSession[\s\S]*if \(cancelled\) return;[\s\S]*setSession\(restored\.session\)/);
    expect(source).toMatch(/finally \{ if \(!cancelled\) setReady\(true\); \}[\s\S]*return \(\) => \{ cancelled = true; \};/);
  });
});
