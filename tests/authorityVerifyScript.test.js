import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("authority verification script", () => {
  it("prints stable machine-readable JSON without mutation side effects", () => {
    const stdout = execFileSync("node", ["tools/authority-verify.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000
    });
    const report = JSON.parse(stdout);

    expect(report.status).toBe("READY_WITH_OWNER_DECISIONS");
    expect(report.ok).toBe(true);
    expect(report.safety).toEqual({
      deploys: false,
      mutatesProduction: false,
      networkCalls: false,
      printsSecretValues: false
    });
    expect(report.checks.noSecretValues).toBe("ok");
    expect(JSON.stringify(report)).not.toContain("service-role-key");
  });
});
