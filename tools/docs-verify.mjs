#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { REQUIRED_CANONICAL_DOCS, stableJson, verifyOperationsDocs } from "../src/docsVerificationModel.js";

const root = process.cwd();
const skipDirs = new Set([".git", "node_modules", "dist", "coverage", ".vercel", "vite-cache"]);

function walk(dir, prefix = "") {
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    if (skipDirs.has(name)) continue;
    const absolute = path.join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    const stat = statSync(absolute);
    if (stat.isDirectory()) files.push(...walk(absolute, relative));
    else if (stat.isFile() && /\.md$/.test(relative)) files.push(relative);
  }
  return files;
}

const markdownFiles = walk(root);
const files = {};
for (const file of [...new Set([...markdownFiles, ...REQUIRED_CANONICAL_DOCS])].sort()) {
  try {
    files[file] = readFileSync(path.join(root, file), "utf8");
  } catch {}
}

const result = verifyOperationsDocs({ files });
console.log(stableJson(result));
process.exitCode = result.ok ? 0 : 1;
