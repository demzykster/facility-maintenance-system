import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("domain change documentation", () => {
  it("documents safe domain cutover boundaries and QR/session risks", () => {
    const runbook = readFileSync("docs/domain-change-runbook.md", "utf8");
    const checklist = readFileSync("docs/domain-change-checklist.md", "utf8");

    expect(runbook).toContain("never cut over or remove the old domain");
    expect(runbook).toContain("Supabase Auth Site URL");
    expect(runbook).toContain("Redirect URLs");
    expect(runbook).toContain("path and query");
    expect(runbook).toContain("Users may need to sign in again");
    expect(runbook).toContain("npm run domain:verify");
    expect(runbook).toContain("Do not try to copy session cookies between domains");
    expect(checklist).toContain("Do not change DNS");
    expect(checklist).toContain("expected SHA");
    expect(checklist).toContain("old QR stickers");
  });
});
