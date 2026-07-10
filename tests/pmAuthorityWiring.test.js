import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("normalized PM authority wiring", () => {
  it("creates a normalized PM authority only for production API storage", () => {
    expect(source).toMatch(/createApiPmProvider\(\{\s*baseUrl: storageApiBaseUrlFromEnv\(import\.meta\.env\),\s*getAccessToken: productionAccessToken\s*\}\)/s);
    expect(source).toContain("normalizedPmAuthorityEnabled({");
    expect(source).toMatch(/NORMALIZED_PM_AUTHORITY = normalizedPmAuthorityEnabled\(\{[\s\S]*appMode: APP_MODE,[\s\S]*storageProvider: storageProviderFromEnv\(import\.meta\.env\),[\s\S]*provider: NORMALIZED_PM_PROVIDER/);
  });

  it("reads PM tasks from normalized API before falling back to KV in production authority mode", () => {
    expect(source).toContain("const normalizedPm = await pmForAuthority({");
    expect(source).toContain("provider: NORMALIZED_PM_PROVIDER");
    expect(source).toContain('action: "load"');
  });

  it("writes normalized PM tasks without recreating KV mirrors in production authority mode", () => {
    expect(source).toMatch(/if \(NORMALIZED_PM_AUTHORITY\) \{[\s\S]*await NORMALIZED_PM_PROVIDER\.upsert\(p\);[\s\S]*\} else \{[\s\S]*persistShared\(`pm:\$\{p\.id\}`/);
    expect(source).not.toMatch(/await NORMALIZED_PM_PROVIDER\.upsert\(p\);[\s\S]*void mirrorPmToKv\(p\);/);
    expect(source).toMatch(/if \(!await persistShared\(`pm:\$\{p\.id\}`, JSON\.stringify\(p\)\)\) return false;[\s\S]*void shadowWriteNormalizedPm\(p\);/);
  });

  it("deletes normalized PM tasks without recreating KV mirrors in production authority mode", () => {
    expect(source).toMatch(/if \(NORMALIZED_PM_AUTHORITY\) \{[\s\S]*await NORMALIZED_PM_PROVIDER\.delete\(id\);[\s\S]*\} else \{[\s\S]*deleteShared\(`pm:\$\{id\}`/);
    expect(source).not.toMatch(/await NORMALIZED_PM_PROVIDER\.delete\(id\);[\s\S]*void mirrorDeletePmFromKv\(id\);/);
    expect(source).toMatch(/if \(!await deleteShared\(`pm:\$\{id\}`\)\) return false;[\s\S]*void shadowDeleteNormalizedPm\(id\);/);
  });
});
