import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("normalized cleaning rounds authority wiring", () => {
  it("creates a normalized cleaning rounds authority only for production API storage", () => {
    expect(source).toMatch(/createApiCleaningRoundsProvider\(\{\s*baseUrl: storageApiBaseUrlFromEnv\(import\.meta\.env\),\s*getAccessToken: productionAccessToken\s*\}\)/s);
    expect(source).toContain("normalizedCleaningRoundsAuthorityEnabled({");
    expect(source).toMatch(/NORMALIZED_CLEANING_ROUNDS_AUTHORITY = normalizedCleaningRoundsAuthorityEnabled\(\{[\s\S]*appMode: APP_MODE,[\s\S]*storageProvider: storageProviderFromEnv\(import\.meta\.env\),[\s\S]*provider: NORMALIZED_CLEANING_ROUNDS_PROVIDER/);
  });

  it("reads cleaning rounds from normalized API before falling back to KV in production authority mode", () => {
    expect(source).toContain("const normalizedCleaningRounds = await cleaningRoundsForAuthority({");
    expect(source).toContain("provider: NORMALIZED_CLEANING_ROUNDS_PROVIDER");
    expect(source).toContain('action: "load"');
  });

  it("writes normalized cleaning rounds first and mirrors to KV in production authority mode", () => {
    expect(source).toMatch(/const saveRound = async \(r\) => \{[\s\S]*const rec = await CLEANING_PHOTOS\.saveRound\(r\);[\s\S]*if \(NORMALIZED_CLEANING_ROUNDS_AUTHORITY\) \{[\s\S]*await NORMALIZED_CLEANING_ROUNDS_PROVIDER\.upsert\(rec\);[\s\S]*void mirrorCleaningRoundToKv\(rec\);/);
    expect(source).toContain('kind: "cleaning_round_kv_mirror_save_failed"');
    expect(source).toMatch(/if \(!await persistShared\(`cround:\$\{rec\.id\}`, JSON\.stringify\(rec\)\)\) return false;[\s\S]*void shadowWriteNormalizedCleaningRound\(rec\);/);
  });
});
