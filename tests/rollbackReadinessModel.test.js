import { describe, expect, it } from "vitest";
import {
  parseRollbackVerifyArgs,
  shaMatches,
  validateReadonlyCommand,
  verifyRollbackReadiness
} from "../src/rollbackReadinessModel.js";

const okVersion = { version: "0.1.0", commit: "abcdef123456", buildTime: "2026-07-23T00:00:00.000Z" };
const okHealth = {
  status: "ok",
  version: "abcdef1",
  checks: { api: "ok", configuration: "ok", database: "ok", storage: "ok" },
  timestamp: "2026-07-23T00:00:00.000Z"
};

function response(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(payload)
  };
}

function fetchSequence(...items) {
  let index = 0;
  return async () => items[index++] || response(okHealth);
}

function gitFixture({
  missingCommits = [],
  packageJson = { scripts: { build: "vite build", "release:check": "node tools/check.mjs" } },
  migrationDiff = "",
  migrationContent = ""
} = {}) {
  const calls = [];
  const gitImpl = async (args) => {
    calls.push(args);
    const joined = args.join(" ");
    if (joined.includes("rev-parse --verify")) {
      const ref = String(args[2] || "");
      if (missingCommits.some((sha) => ref.startsWith(sha))) throw new Error("missing");
      return "target-full-sha\n";
    }
    if (joined.includes(":package.json")) return JSON.stringify(packageJson);
    if (joined.includes("diff --name-status")) return migrationDiff;
    if (joined.includes(":supabase/migrations/")) return migrationContent;
    return "";
  };
  gitImpl.calls = calls;
  return gitImpl;
}

async function verify(overrides = {}) {
  return verifyRollbackReadiness({
    argv: [
      "--production-url", "https://example.test",
      "--expected-current-sha", "abcdef1",
      "--target-sha", "abcdef1"
    ],
    fetchImpl: fetchSequence(response(okVersion), response(okHealth)),
    gitImpl: gitFixture(),
    now: () => "2026-07-23T00:00:00.000Z",
    ...overrides
  });
}

describe("rollback readiness model", () => {
  it("requires explicit arguments", async () => {
    const result = await verifyRollbackReadiness({ argv: [], fetchImpl: async () => response(okVersion), gitImpl: gitFixture() });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("missing_args:productionUrl,expectedCurrentSha,targetSha");
  });

  it("parses arguments and supports sha prefixes", () => {
    expect(parseRollbackVerifyArgs([
      "--production-url=https://example.test",
      "--expected-current-sha", "abcdef1",
      "--target", "1234567",
      "--post-rollback-expected-sha=7654321",
      "--timeout=25"
    ])).toMatchObject({
      productionUrl: "https://example.test",
      expectedCurrentSha: "abcdef1",
      targetSha: "1234567",
      postRollbackExpectedSha: "7654321",
      timeoutMs: 25
    });
    expect(shaMatches("abcdef123456", "abcdef1")).toBe(true);
  });

  it("fails closed on current SHA mismatch", async () => {
    const result = await verify({
      fetchImpl: fetchSequence(response({ ...okVersion, commit: "1111111" }), response(okHealth))
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("current_sha_mismatch");
    expect(result.checks.version).toBe("failed");
  });

  it("fails closed when the target commit is missing", async () => {
    const result = await verify({
      argv: [
        "--production-url", "https://example.test",
        "--expected-current-sha", "abcdef1",
        "--target-sha", "missing-target"
      ],
      gitImpl: gitFixture({ missingCommits: ["missing-target"] })
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.errors).toContain("target_commit_missing");
    expect(result.errors).not.toContain("migration_risk_detected");
  });

  it("fails closed when health is degraded", async () => {
    const result = await verify({
      fetchImpl: fetchSequence(response(okVersion), response({ ...okHealth, status: "degraded" }, { ok: false, status: 503 }))
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("health_degraded");
    expect(result.checks.health).toBe("failed");
  });

  it("fails closed when the version endpoint is unavailable", async () => {
    const result = await verify({
      fetchImpl: fetchSequence(response({}, { ok: false, status: 503 }), response(okHealth))
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("version_endpoint_unavailable");
  });

  it("detects migration risk between current and target", async () => {
    const result = await verify({
      gitImpl: gitFixture({
        migrationDiff: "A\tsupabase/migrations/20260723000000_drop_old_table.sql\n",
        migrationContent: "drop table public.old_table;"
      })
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("ROLLBACK_UNSAFE");
    expect(result.errors).toContain("migration_risk_detected");
    expect(result.migrations.files[0]).toMatchObject({
      file: "supabase/migrations/20260723000000_drop_old_table.sql",
      destructive: true
    });
  });

  it("passes for a safe target with no migration delta", async () => {
    const result = await verify();

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
    expect(result.checks).toMatchObject({
      version: "ok",
      health: "ok",
      currentCommit: "ok",
      targetCommit: "ok",
      targetReleaseScripts: "ok",
      migrationCompatibility: "ok"
    });
  });

  it("does not execute mutation commands", async () => {
    const gitImpl = gitFixture();
    await verify({ gitImpl });

    const commands = gitImpl.calls.map((args) => args.join(" "));
    expect(commands.some((command) => !validateReadonlyCommand(command))).toBe(false);
    expect(commands.join("\n")).not.toMatch(/\b(vercel|deploy|rollback|alias|push|delete)\b/i);
  });

  it("returns stable machine-readable output without secrets", async () => {
    const result = await verify({
      fetchImpl: fetchSequence(response({ ...okVersion, commit: "service-role-secret abcdef1" }), response(okHealth))
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serialized).not.toContain("service-role-secret");
    expect(result).toHaveProperty("ok");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("checks");
    expect(result).toHaveProperty("errors");
  });
});
