import { describe, expect, it } from "vitest";
import {
  buildPlatformVerificationReport,
  classifyEnvironmentName,
  classifyVercelReference,
  detectPersistentFilesystemWrites,
  parsePlatformVerifyArgs,
  platformTargetProfile,
  scanPlatformInventory,
  stableJson
} from "../src/platformPortabilityModel.js";

const files = [
  "package.json",
  "vercel.json",
  "vite.config.js",
  "api/health.js",
  "api/tickets/index.js",
  "server/health/handler.js",
  "server/session/authCookie.js",
  "tools/static-server.cjs",
  "tools/staging-gate.mjs",
  "docs/platform-portability-runbook.md"
];

const packageJson = {
  scripts: {
    build: "vite build --configLoader native",
    serve: "node tools/static-server.cjs",
    lint: "node tools/static-syntax-check.mjs",
    test: "vitest run"
  }
};

describe("platform portability model", () => {
  it("parses a target argument", () => {
    expect(parsePlatformVerifyArgs(["--target=cloud-run"])).toMatchObject({ target: "cloud-run" });
    expect(parsePlatformVerifyArgs(["--target", "azure-app-service"])).toMatchObject({ target: "azure-app-service" });
  });

  it("builds stable machine-readable inventory", () => {
    const report = buildPlatformVerificationReport({
      target: "vercel",
      packageJson,
      files,
      buildResult: { attempted: true, ok: true, skipped: false },
      entries: [
        { file: "server/health/handler.js", line: "const sha = process.env.CMMS_BUILD_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA;" },
        { file: "server/session/authCookie.js", line: "if (env.NODE_ENV === \"production\" || env.VERCEL === \"1\") attrs.push(\"Secure\");" }
      ],
      nodeVersion: "v24.17.0",
      gitCommit: "567a5f9571537c7afb82c88671aeac12aee8ca3c"
    });

    expect(report.ok).toBe(true);
    expect(report.status).toBe("READY");
    expect(report.runtime.apiRouteCount).toBe(2);
    expect(report.checks.buildExecution).toBe("ok");
    expect(report.build).toMatchObject({ attempted: true, ok: true, skipped: false });
    expect(JSON.parse(stableJson(report))).toMatchObject({ target: "vercel" });
  });

  it("detects Vercel runtime dependency without treating tooling as runtime blocker", () => {
    expect(classifyVercelReference({ file: "vercel.json", line: "{ \"rewrites\": [] }" })).toBe("VERCEL_RUNTIME_DEPENDENCY");
    expect(classifyVercelReference({ file: "tools/staging-gate.mjs", line: "vercel deploy --prod" })).toBe("VERCEL_TOOLING_ONLY");
    expect(classifyVercelReference({ file: "docs/runbook.md", line: "Use Vercel as current host." })).toBe("VERCEL_TOOLING_ONLY");
  });

  it("classifies platform-provided SHA fallback as configuration-only", () => {
    expect(classifyVercelReference({
      file: "server/health/handler.js",
      line: "env.CMMS_BUILD_COMMIT || env.VERCEL_GIT_COMMIT_SHA || \"local\""
    })).toBe("CONFIGURATION_ONLY");
    expect(classifyEnvironmentName("VERCEL_GIT_COMMIT_SHA")).toMatchObject({
      category: "platform-provided",
      neutralAlternative: "CMMS_BUILD_COMMIT",
      vercelSpecific: true
    });
  });

  it("detects persistent runtime filesystem writes", () => {
    const writes = detectPersistentFilesystemWrites([
      { file: "server/files/handler.js", line: "await fs.writeFile(\"uploads/a\", body)" },
      { file: "tools/report.mjs", line: "writeFileSync(\"report.json\", json)" }
    ]);

    expect(writes).toEqual([{
      file: "server/files/handler.js",
      line: "await fs.writeFile(\"uploads/a\", body)",
      classification: "PORTABILITY_RISK"
    }]);
  });

  it("fails closed for unsupported targets", () => {
    const profile = platformTargetProfile("kubernetes");
    expect(profile.ok).toBe(false);
    expect(profile.status).toBe("NOT_VERIFIED");
    expect(profile.blockers).toContain("unsupported_target");
  });

  it("requires health and version endpoints", () => {
    const report = buildPlatformVerificationReport({
      target: "vercel",
      packageJson,
      files: ["package.json", "api/tickets/index.js"],
      buildResult: { attempted: true, ok: true },
      entries: [],
      nodeVersion: "v24.17.0"
    });

    expect(report.ok).toBe(false);
    expect(report.checks.healthEndpoint).toBe("failed");
    expect(report.checks.versionStrategy).toBe("failed");
  });

  it("marks Docker as adapter-required until a production API entrypoint exists", () => {
    const report = buildPlatformVerificationReport({
      target: "docker",
      packageJson,
      files,
      buildResult: { attempted: true, ok: true },
      entries: [],
      nodeVersion: "v24.17.0"
    });

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SMALL_ADAPTER_REQUIRED");
    expect(report.targetProfile.blockers).toContain("node_api_adapter_missing");
  });

  it("does not execute or recommend deployment and production write commands", () => {
    const report = buildPlatformVerificationReport({
      target: "vercel",
      packageJson,
      files,
      buildResult: { attempted: true, ok: true },
      entries: [
        { file: "tools/platform-verify.mjs", line: "console.log(JSON.stringify(report));" }
      ],
      nodeVersion: "v24.17.0"
    });

    expect(report.safety.deploys).toBe(false);
    expect(report.safety.mutatesProduction).toBe(false);
    expect(report.checks.noDeploymentCommands).toBe("ok");
    expect(report.checks.noProductionWrites).toBe("ok");
  });

  it("fails closed when executable surfaces contain deployment commands", () => {
    const report = buildPlatformVerificationReport({
      target: "vercel",
      packageJson,
      files,
      buildResult: { attempted: true, ok: true },
      entries: [
        { file: "docs/runbook.md", line: "During approved rollback, Vercel alias may be changed by the owner." },
        { file: "tools/release.mjs", line: "execFileSync(\"vercel\", [\"deploy\", \"--prod\"]);" }
      ],
      nodeVersion: "v24.17.0"
    });

    expect(report.ok).toBe(false);
    expect(report.checks.noDeploymentCommands).toBe("failed");
    expect(report.inventory.unsafeCommands).toEqual([{
      file: "tools/release.mjs",
      line: "execFileSync(\"vercel\", [\"deploy\", \"--prod\"]);"
    }]);
  });

  it("does not include secret values in inventory", () => {
    const inventory = scanPlatformInventory([
      { file: "server/health/handler.js", line: "const key = process.env.SUPABASE_SERVICE_ROLE_KEY;" },
      { file: "server/ai/providerClient.js", line: "const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;" }
    ]);
    const serialized = JSON.stringify(inventory);

    expect(serialized).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serialized).toContain("GOOGLE_GENERATIVE_AI_API_KEY");
    expect(serialized).not.toContain("secret-value");
    expect(inventory.env.every((entry) => !Object.prototype.hasOwnProperty.call(entry, "value"))).toBe(true);
  });

  it("keeps tooling-only mutation references out of runtime blockers", () => {
    const inventory = scanPlatformInventory([
      { file: "tools/release.mjs", line: "console.log(\"vercel deploy\")" },
      { file: "docs/history.md", line: "Vercel appears in historical rollout notes." },
      { file: "server/health/handler.js", line: "const requestId = headerValue(req.headers, \"x-vercel-id\");" }
    ]);

    expect(inventory.vercelReferences.find((entry) => entry.file === "tools/release.mjs").classification).toBe("VERCEL_TOOLING_ONLY");
    expect(inventory.vercelReferences.find((entry) => entry.file === "docs/history.md")).toBeUndefined();
    expect(inventory.vercelReferences.find((entry) => entry.file === "server/health/handler.js").classification).toBe("CONFIGURATION_ONLY");
  });

  it("requires successful local build execution for ready targets", () => {
    const report = buildPlatformVerificationReport({
      target: "vercel",
      packageJson,
      files,
      buildResult: { attempted: true, ok: false, error: "build_failed" },
      entries: [],
      nodeVersion: "v24.17.0"
    });

    expect(report.ok).toBe(false);
    expect(report.checks.buildExecution).toBe("failed");
    expect(report.build.error).toBe("build_failed");
  });
});
