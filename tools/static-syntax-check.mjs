#!/usr/bin/env node
import { readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const ROOTS = ["api", "server", "src", "tests", "tools"];
const CHECK_EXTENSIONS = new Set([".js", ".mjs"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".vite", "coverage"]);

function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      collectFiles(path, files);
      continue;
    }
    if (CHECK_EXTENSIONS.has(extname(entry))) files.push(path);
  }
  return files;
}

const files = ROOTS.flatMap((root) => collectFiles(root)).sort();
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    failures.push({
      file: relative(process.cwd(), file),
      output: `${result.stdout || ""}${result.stderr || ""}`.trim()
    });
  }
}

if (failures.length) {
  console.error(`[static-syntax] failed ${failures.length}/${files.length}`);
  for (const failure of failures) {
    console.error(`\n${failure.file}\n${failure.output}`);
  }
  process.exit(1);
}

console.log(`[static-syntax] ok ${files.length} files`);
