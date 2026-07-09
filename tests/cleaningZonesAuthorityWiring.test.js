import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("normalized cleaning zones authority wiring", () => {
  it("creates a normalized cleaning zones authority only for production API storage", () => {
    expect(source).toMatch(/createApiCleaningZonesProvider\(\{\s*baseUrl: storageApiBaseUrlFromEnv\(import\.meta\.env\),\s*getAccessToken: productionAccessToken\s*\}\)/s);
    expect(source).toContain("normalizedCleaningZonesAuthorityEnabled({");
    expect(source).toMatch(/NORMALIZED_CLEANING_ZONES_AUTHORITY = normalizedCleaningZonesAuthorityEnabled\(\{[\s\S]*appMode: APP_MODE,[\s\S]*storageProvider: storageProviderFromEnv\(import\.meta\.env\),[\s\S]*provider: NORMALIZED_CLEANING_ZONES_PROVIDER/);
  });

  it("reads cleaning zones from normalized API before falling back to KV in production authority mode", () => {
    expect(source).toContain("const normalizedCleaningZones = await cleaningZonesForAuthority({");
    expect(source).toContain("provider: NORMALIZED_CLEANING_ZONES_PROVIDER");
    expect(source).toContain('action: "load"');
  });

  it("writes normalized cleaning zones first and mirrors to KV in production authority mode", () => {
    expect(source).toMatch(/if \(NORMALIZED_CLEANING_ZONES_AUTHORITY\) \{[\s\S]*await NORMALIZED_CLEANING_ZONES_PROVIDER\.upsert\(z\);[\s\S]*void mirrorCleaningZoneToKv\(z\);/);
    expect(source).toContain('kind: "cleaning_zone_kv_mirror_save_failed"');
    expect(source).toMatch(/if \(!await persistShared\(`czone:\$\{z\.id\}`, JSON\.stringify\(z\)\)\) return false;[\s\S]*void shadowWriteNormalizedCleaningZone\(z\);/);
  });

  it("deletes normalized cleaning zones first while keeping dependent KV cleanup intact", () => {
    expect(source).toMatch(/if \(NORMALIZED_CLEANING_ZONES_AUTHORITY\) \{[\s\S]*await NORMALIZED_CLEANING_ZONES_PROVIDER\.delete\(plan\.zoneId\);[\s\S]*void mirrorDeleteCleaningZoneFromKv\(plan\.zoneId\);/);
    expect(source).toContain('kind: "cleaning_zone_kv_mirror_delete_failed"');
    expect(source).toContain("if (NORMALIZED_CLEANING_ZONES_AUTHORITY && key === `czone:${plan.zoneId}`) continue;");
    expect(source).toContain("if (!await deleteShared(key)) return false;");
    expect(source).toContain("void shadowDeleteNormalizedCleaningZone(plan.zoneId);");
  });
});
