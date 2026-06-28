import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";

const file = ".env.staging.local";

if (!existsSync(file)) {
  console.error(`[staging-smoke] ${file} not found`);
  console.error(`[staging-smoke] copy .env.staging.example to ${file}, fill real values, then rerun`);
  process.exit(1);
}

applyEnvValues(process.env, parseEnvFile(readFileSync(file, "utf8")));

await import("./staging-smoke-preflight.mjs");
