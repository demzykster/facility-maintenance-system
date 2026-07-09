import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("normalized ticket authority wiring", () => {
  it("creates a normalized ticket authority only for production API storage", () => {
    expect(source).toMatch(/createApiTicketProvider\(\{\s*baseUrl: storageApiBaseUrlFromEnv\(import\.meta\.env\),\s*getAccessToken: productionAccessToken\s*\}\)/s);
    expect(source).toContain("normalizedTicketAuthorityEnabled({");
    expect(source).toMatch(/NORMALIZED_TICKET_AUTHORITY = normalizedTicketAuthorityEnabled\(\{[\s\S]*appMode: APP_MODE,[\s\S]*storageProvider: storageProviderFromEnv\(import\.meta\.env\),[\s\S]*provider: NORMALIZED_TICKET_PROVIDER/);
  });

  it("reads tickets from normalized API before falling back to KV in production authority mode", () => {
    expect(source).toContain("const normalized = await ticketsForAuthority({");
    expect(source).toContain("provider: NORMALIZED_TICKET_PROVIDER");
    expect(source).toContain('action: "load"');
  });

  it("writes normalized tickets first and mirrors to KV in production authority mode", () => {
    expect(source).toMatch(/if \(NORMALIZED_TICKET_AUTHORITY\) \{[\s\S]*await NORMALIZED_TICKET_PROVIDER\.upsert\(rec\);[\s\S]*void mirrorTicketToKv\(rec\);/);
    expect(source).toContain('kind: "ticket_kv_mirror_save_failed"');
    expect(source).toMatch(/if \(!await persistShared\(`ticket:\$\{rec\.id\}`, JSON\.stringify\(rec\)\)\) return false;[\s\S]*void shadowWriteNormalizedTicket\(rec\);/);
  });

  it("deletes normalized tickets first and mirrors the delete to KV in production authority mode", () => {
    expect(source).toMatch(/if \(NORMALIZED_TICKET_AUTHORITY\) \{[\s\S]*await NORMALIZED_TICKET_PROVIDER\.delete\(id\);[\s\S]*void mirrorDeleteTicketFromKv\(id\);/);
    expect(source).toContain('kind: "ticket_kv_mirror_delete_failed"');
    expect(source).toMatch(/if \(!await deleteShared\(`ticket:\$\{id\}`\)\) return false;[\s\S]*void shadowDeleteNormalizedTicket\(id\);/);
  });
});
