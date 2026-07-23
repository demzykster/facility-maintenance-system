#!/usr/bin/env node
import { verifyDomainPortability } from "../src/domainPortabilityModel.js";

const result = await verifyDomainPortability({
  argv: process.argv.slice(2),
  env: process.env,
  fetchImpl: globalThis.fetch
});

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
