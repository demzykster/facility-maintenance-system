import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("normalized work-record authority wiring", () => {
  it("creates a normalized work authority only for production API storage", () => {
    expect(source).toMatch(/createApiWorkProvider\(\{\s*baseUrl: storageApiBaseUrlFromEnv\(import\.meta\.env\),\s*getAccessToken: productionAccessToken\s*\}\)/s);
    expect(source).toContain("normalizedWorkAuthorityEnabled({");
    expect(source).toMatch(/NORMALIZED_WORK_AUTHORITY = normalizedWorkAuthorityEnabled\(\{[\s\S]*appMode: APP_MODE,[\s\S]*storageProvider: storageProviderFromEnv\(import\.meta\.env\),[\s\S]*provider: NORMALIZED_WORK_PROVIDER/);
  });

  it("writes normalized tasks and meetings without recreating KV mirrors in production authority mode", () => {
    expect(source).toMatch(/if \(NORMALIZED_WORK_AUTHORITY\) \{[\s\S]*await workResourceProvider\(resource\)\?\.upsert\?\.?\(record\);[\s\S]*\} else \{[\s\S]*persistShared\(key, JSON\.stringify\(record\)\)/);
    expect(source).not.toMatch(/await workResourceProvider\(resource\)\?\.upsert\?\.?\(record\);[\s\S]*void mirrorWorkToKv\(resource, record\);/);
  });

  it("deletes normalized tasks and meetings without recreating KV mirrors in production authority mode", () => {
    expect(source).toMatch(/if \(NORMALIZED_WORK_AUTHORITY\) \{[\s\S]*await workResourceProvider\(resource\)\?\.delete\?\.?\(id\);[\s\S]*\} else \{[\s\S]*deleteShared\(key\)/);
    expect(source).not.toMatch(/await workResourceProvider\(resource\)\?\.delete\?\.?\(id\);[\s\S]*void mirrorDeleteWorkFromKv\(resource, id\);/);
  });
});
