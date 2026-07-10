import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/ClaudeMaintenanceApp.jsx", "utf8");

describe("presence authority wiring", () => {
  it("wires normalized presence authority into production API mode", () => {
    expect(source).toMatch(/createApiPresenceProvider\(\{\s*baseUrl: storageApiBaseUrlFromEnv\(import\.meta\.env\),\s*getAccessToken: productionAccessToken\s*\}\)/s);
    expect(source).toContain("normalizedPresenceAuthorityEnabled({");
    expect(source).toMatch(/NORMALIZED_PRESENCE_AUTHORITY = normalizedPresenceAuthorityEnabled\(\{[\s\S]*appMode: APP_MODE,[\s\S]*storageProvider: storageProviderFromEnv\(import\.meta\.env\),[\s\S]*provider: NORMALIZED_PRESENCE_PROVIDER/);
  });

  it("loads and writes presence through the normalized provider before the KV mirror", () => {
    expect(source).toContain("const normalizedPresence = await presenceForAuthority({");
    expect(source).toContain("await NORMALIZED_PRESENCE_PROVIDER.upsert(record);");
    expect(source).toContain("void mirrorPresenceToKv(record);");
  });
});
