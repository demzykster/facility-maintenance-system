import { describe, expect, it } from "vitest";
import { parseVercelEnvListOutput, vercelEnvPreflight } from "../src/vercelEnvPreflightModel.js";

describe("vercel env preflight model", () => {
  it("parses env names from Vercel CLI table output without values", () => {
    const names = parseVercelEnvListOutput(`
Vercel CLI 54.18.1
name                          value        environments
VITE_CMMS_APP_MODE            Encrypted    Production, Preview
SUPABASE_SERVICE_ROLE_KEY     Encrypted    Production
CMMS_FILE_BUCKET              Encrypted    Production, Preview
`);

    expect([...names].sort()).toEqual([
      "CMMS_FILE_BUCKET",
      "SUPABASE_SERVICE_ROLE_KEY",
      "VITE_CMMS_APP_MODE"
    ]);
  });

  it("reports missing required env separately from optional env", () => {
    const result = vercelEnvPreflight({
      foundNames: new Set(["A", "C"]),
      required: ["A", "B"],
      optional: ["C", "D"]
    });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["B"]);
    expect(result.optionalMissing).toEqual(["D"]);
  });
});
