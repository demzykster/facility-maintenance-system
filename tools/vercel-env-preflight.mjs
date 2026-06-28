import { execFileSync } from "node:child_process";
import { STAGING_SMOKE_OPTIONAL_ENV, STAGING_SMOKE_REQUIRED_ENV } from "../src/stagingSmokePreflightModel.js";
import { parseVercelEnvListOutput, vercelEnvPreflight } from "../src/vercelEnvPreflightModel.js";

const args = process.argv.slice(2);
const scopeIndex = args.indexOf("--scope");
const scope = scopeIndex >= 0 ? args[scopeIndex + 1] : "";
const commandArgs = ["vercel", "env", "ls"];
if (scope) commandArgs.push("--scope", scope);

let output = "";
try {
  output = execFileSync("npx", commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
} catch (error) {
  const stderr = String(error?.stderr || "").trim();
  const stdout = String(error?.stdout || "").trim();
  console.error("[vercel-env] failed to list Vercel environment variables");
  if (stderr) console.error(stderr);
  if (stdout) console.error(stdout);
  process.exit(1);
}

const foundNames = parseVercelEnvListOutput(output);
const result = vercelEnvPreflight({
  foundNames,
  required: STAGING_SMOKE_REQUIRED_ENV,
  optional: STAGING_SMOKE_OPTIONAL_ENV
});

for (const name of result.optionalMissing) {
  console.warn(`[vercel-env] optional env not found: ${name}`);
}

if (!result.ok) {
  console.error("[vercel-env] preflight failed");
  for (const name of result.missing) console.error(`- missing_env:${name}`);
  process.exit(1);
}

console.log("[vercel-env] preflight ok");
console.log(JSON.stringify({
  ok: result.ok,
  foundRequired: STAGING_SMOKE_REQUIRED_ENV.length,
  optionalMissing: result.optionalMissing
}, null, 2));
