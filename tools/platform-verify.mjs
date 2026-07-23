#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  buildPlatformVerificationReport,
  parsePlatformVerifyArgs,
  stableJson
} from "../src/platformPortabilityModel.js";

const root = process.cwd();
const args = parsePlatformVerifyArgs(process.argv.slice(2));
const skipDirs = new Set([".git", "node_modules", "dist", "coverage", ".vercel", "vite-cache"]);

function walk(dir, prefix = "") {
  const entries = [];
  for (const name of readdirSync(dir).sort()) {
    if (skipDirs.has(name)) continue;
    const absolute = path.join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    const stat = statSync(absolute);
    if (stat.isDirectory()) entries.push(...walk(absolute, relative));
    else if (stat.isFile()) entries.push(relative);
  }
  return entries;
}

function textEntries(files = []) {
  const wanted = /^(api|server|src|tools|tests|docs|\.github)\//;
  const extra = new Set(["package.json", "vercel.json", "vite.config.js"]);
  const rows = [];
  for (const file of files) {
    if (!wanted.test(file) && !extra.has(file)) continue;
    if (!/\.(js|jsx|mjs|cjs|json|md|yml|yaml)$/.test(file)) continue;
    let text = "";
    try {
      text = readFileSync(path.join(root, file), "utf8");
    } catch {
      continue;
    }
    text.split(/\r?\n/).forEach((line, index) => {
      rows.push({ file, lineNumber: index + 1, line });
    });
  }
  return rows;
}

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function packageJson() {
  const file = path.join(root, "package.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

function runBuildCheck({ skip = false } = {}) {
  if (skip) return { attempted: false, ok: false, skipped: true };
  try {
    execFileSync("npm", ["run", "build"], {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "ignore", "ignore"],
      timeout: 120000,
      maxBuffer: 1024 * 1024
    });
    return { attempted: true, ok: true, skipped: false };
  } catch {
    return { attempted: true, ok: false, skipped: false, error: "build_failed" };
  }
}

const files = walk(root);
const report = buildPlatformVerificationReport({
  target: args.target,
  packageJson: packageJson(),
  files,
  entries: textEntries(files),
  buildResult: runBuildCheck({ skip: args.skipBuild }),
  nodeVersion: process.version,
  gitCommit: gitCommit()
});

console.log(stableJson(report));
process.exitCode = report.ok ? 0 : 1;
