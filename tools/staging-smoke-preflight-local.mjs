import { existsSync, readFileSync } from "node:fs";
import { parseEnvFile } from "../src/envFileModel.js";

const file = ".env.staging.local";

if (!existsSync(file)) {
  console.error(`[staging-smoke] ${file} not found`);
  console.error(`[staging-smoke] copy .env.staging.example to ${file}, fill real values, then rerun`);
  process.exit(1);
}

const parsed = parseEnvFile(readFileSync(file, "utf8"));
for (const [key, value] of Object.entries(parsed)) {
  if (!process.env[key]) process.env[key] = value;
}

await import("./staging-smoke-preflight.mjs");
