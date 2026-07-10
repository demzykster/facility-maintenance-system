import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/ClaudeMaintenanceApp.jsx", "utf8");

describe("settings records authority wiring", () => {
  it("writes app issues through the normalized provider without creating a KV mirror in authority mode", () => {
    expect(source).toContain("await NORMALIZED_SETTINGS_RECORDS_PROVIDER.appIssues?.upsert?.(x);");
    expect(source).toContain("await NORMALIZED_SETTINGS_RECORDS_PROVIDER.appIssues.upsert(issue);");
    expect(source).not.toContain("void mirrorAppIssueToKv(x);");
    expect(source).not.toContain("const mirrorAppIssueToKv = async");
  });

  it("keeps the legacy KV write path for non-authority app issue saves", () => {
    expect(source).toContain("if (!await persistShared(`appIssue:${x.id}`, JSON.stringify(x))) return false;");
    expect(source).toContain("ok = await store.set(`appIssue:${issue.id}`, JSON.stringify(issue), true);");
    expect(source).toContain("void shadowWriteNormalizedAppIssue(x);");
  });
});
