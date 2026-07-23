#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { verifyRollbackReadiness } from "../src/rollbackReadinessModel.js";

const execFileAsync = promisify(execFile);

async function gitImpl(args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    timeout: 15000,
    maxBuffer: 1024 * 1024
  });
  return stdout;
}

const result = await verifyRollbackReadiness({
  argv: process.argv.slice(2),
  env: process.env,
  fetchImpl: globalThis.fetch,
  gitImpl
});

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
