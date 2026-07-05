#!/usr/bin/env node
import { spawnSync } from "node:child_process";

export function runInstalledScript(scriptName) {
  const target = `/Users/Vadim/.agents/skills/impeccable/scripts/${scriptName}`;
  const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 0);
}
