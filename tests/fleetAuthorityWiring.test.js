import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("normalized fleet authority wiring", () => {
  it("creates a normalized fleet authority only for production API storage", () => {
    expect(source).toMatch(/createApiFleetProvider\(\{\s*baseUrl: storageApiBaseUrlFromEnv\(import\.meta\.env\),\s*getAccessToken: productionAccessToken\s*\}\)/s);
    expect(source).toContain("normalizedFleetAuthorityEnabled({");
    expect(source).toMatch(/NORMALIZED_FLEET_AUTHORITY = normalizedFleetAuthorityEnabled\(\{[\s\S]*appMode: APP_MODE,[\s\S]*storageProvider: storageProviderFromEnv\(import\.meta\.env\),[\s\S]*provider: NORMALIZED_FLEET_PROVIDER/);
  });

  it("reads fleet units from normalized API before falling back to KV in production authority mode", () => {
    expect(source).toContain("const normalizedFleet = await fleetForAuthority({");
    expect(source).toContain("provider: NORMALIZED_FLEET_PROVIDER");
    expect(source).toContain('action: "load"');
  });

  it("writes normalized fleet units first and mirrors to KV in production authority mode", () => {
    expect(source).toMatch(/if \(NORMALIZED_FLEET_AUTHORITY\) \{[\s\S]*await NORMALIZED_FLEET_PROVIDER\.upsert\(f\);[\s\S]*void mirrorFleetToKv\(f\);/);
    expect(source).toContain('kind: "fleet_kv_mirror_save_failed"');
    expect(source).toMatch(/if \(!await persistShared\(`fleet:\$\{f\.id\}`, JSON\.stringify\(f\), options\)\) return false;[\s\S]*void shadowWriteNormalizedFleet\(f\);/);
  });

  it("deletes normalized fleet units first and mirrors the delete to KV in production authority mode", () => {
    expect(source).toMatch(/if \(NORMALIZED_FLEET_AUTHORITY\) \{[\s\S]*await NORMALIZED_FLEET_PROVIDER\.delete\(id\);[\s\S]*void mirrorDeleteFleetFromKv\(id\);/);
    expect(source).toContain('kind: "fleet_kv_mirror_delete_failed"');
    expect(source).toMatch(/if \(!await deleteShared\(`fleet:\$\{id\}`, options\)\) return false;[\s\S]*void shadowDeleteNormalizedFleet\(id\);/);
  });
});
