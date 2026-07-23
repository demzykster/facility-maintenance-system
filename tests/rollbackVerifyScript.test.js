import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("rollback verify script", () => {
  it("exits non-zero with machine-readable JSON when required args are missing", async () => {
    await expect(execFileAsync(process.execPath, ["tools/rollback-verify.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CMMS_ROLLBACK_PRODUCTION_URL: "",
        CMMS_ROLLBACK_EXPECTED_CURRENT_SHA: "",
        CMMS_ROLLBACK_TARGET_SHA: ""
      }
    })).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("\"missing_args:productionUrl,expectedCurrentSha,targetSha\"")
    });
  });
});
