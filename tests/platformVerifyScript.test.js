import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

function runPlatformVerify(args = []) {
  return execFileAsync(process.execPath, ["tools/platform-verify.mjs", ...args], {
    cwd: process.cwd(),
    timeout: 150000,
    maxBuffer: 1024 * 1024 * 5
  });
}

describe("platform verify script", () => {
  it("runs a local build for the current Vercel target and prints stable JSON", async () => {
    const result = await runPlatformVerify(["--target=vercel"]);
    const payload = JSON.parse(result.stdout);

    expect(payload).toMatchObject({
      ok: true,
      status: "READY",
      target: "vercel",
      build: { attempted: true, ok: true, skipped: false },
      safety: {
        deploys: false,
        mutatesProduction: false,
        networkCalls: false,
        printsSecretValues: false
      }
    });
    expect(payload.checks.buildExecution).toBe("ok");
    expect(result.stdout).not.toContain("fake-secret-value");
  });

  it("fails closed for unsupported targets without running a build", async () => {
    await expect(runPlatformVerify(["--target=kubernetes", "--skip-build"])).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("\"status\": \"NOT_VERIFIED\"")
    });
  });

  it("reports non-Vercel targets as adapter-required until a production API entrypoint exists", async () => {
    await expect(runPlatformVerify(["--target=docker", "--skip-build"])).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("\"status\": \"SMALL_ADAPTER_REQUIRED\"")
    });
  });
});
