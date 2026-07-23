import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("domain verify script", () => {
  it("requires explicit URLs and prints machine-readable JSON", async () => {
    await expect(execFileAsync(process.execPath, ["tools/domain-verify.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CMMS_DOMAIN_CURRENT_URL: "",
        CMMS_DOMAIN_CANDIDATE_URL: "",
        CMMS_DOMAIN_EXPECTED_SHA: ""
      }
    })).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("\"missing_args:currentUrl,candidateUrl,expectedSha\"")
    });
  });
});
