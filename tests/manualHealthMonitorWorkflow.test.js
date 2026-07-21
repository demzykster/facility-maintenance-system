import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/manual-health-monitor.yml";

describe("manual health monitor workflow", () => {
  it("is manual-only and runs the health smoke without secrets or deploy steps", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain("workflow_dispatch:");
    expect(source).toMatch(/required:\s+true/);
    expect(source).not.toMatch(/^\s*schedule:/m);
    expect(source).toContain("npm run health:check");
    expect(source).not.toContain("CMMS_HEALTH_BASE_URL");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("secrets.");
    expect(source).not.toMatch(/\bvercel\s+deploy\b/i);
    expect(source).not.toMatch(/\bdeploy\b/i);
  });
});
