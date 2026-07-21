#!/usr/bin/env node
import { runHealthSmoke } from "../src/healthSmokeModel.js";

const result = await runHealthSmoke({
  argv: process.argv.slice(2),
  env: process.env,
  fetchImpl: globalThis.fetch
});

if (result.ok) {
  console.log(`Health ok: ${result.url} version=${result.version}`);
  process.exitCode = 0;
} else {
  const details = [
    `Health failed: ${result.error}`,
    result.statusCode ? `http=${result.statusCode}` : "",
    result.status ? `status=${result.status}` : "",
    result.requestId ? `requestId=${result.requestId}` : "",
    result.url ? `url=${result.url}` : ""
  ].filter(Boolean).join(" ");
  console.error(details);
  process.exitCode = 1;
}
