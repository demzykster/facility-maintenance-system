import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("normalized ticket shadow-write wiring", () => {
  it("creates a normalized ticket provider only for production API storage", () => {
    expect(source).toMatch(/createApiTicketProvider\(\{\s*baseUrl: storageApiBaseUrlFromEnv\(import\.meta\.env\),\s*getAccessToken: productionAccessToken\s*\}\)/s);
    expect(source).toMatch(/NORMALIZED_TICKET_SHADOW_WRITE\s*=\s*APP_MODE === APP_MODES\.production[\s\S]*storageProviderFromEnv\(import\.meta\.env\) === STORAGE_PROVIDERS\.api/);
  });

  it("keeps KV ticket save authoritative and writes normalized tickets in the background", () => {
    expect(source).toMatch(/if \(!await persistShared\(`ticket:\$\{rec\.id\}`, JSON\.stringify\(rec\)\)\) return false;/);
    expect(source).toMatch(/void shadowWriteNormalizedTicket\(rec\);/);
    expect(source).toMatch(/kind: "ticket_normalized_shadow_write_failed"/);
  });

  it("keeps KV ticket delete authoritative and deletes normalized tickets in the background", () => {
    expect(source).toMatch(/const delTicket = async \(id\) => \{ if \(!await deleteShared\(`ticket:\$\{id\}`\)\) return false;/);
    expect(source).toMatch(/void shadowDeleteNormalizedTicket\(id\);/);
    expect(source).toMatch(/kind: "ticket_normalized_shadow_delete_failed"/);
  });
});
