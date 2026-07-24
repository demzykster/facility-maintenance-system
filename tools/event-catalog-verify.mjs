#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { NOTIFICATION_KIND_IDS } from "../src/notificationModel.js";
import {
  stableEventCatalogJson,
  verifyCanonicalEventCatalog
} from "./contracts/eventCatalogVerificationModel.js";

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
    else if (stat.isFile() && /\.(js|jsx|mjs|cjs|md)$/.test(relative)) files.push(relative);
  }
  return files;
}

function readFiles(files = []) {
  const result = {};
  for (const file of files) {
    try {
      result[file] = readFileSync(path.join(root, file), "utf8");
    } catch {}
  }
  return result;
}

function pushKindsFromSource(text = "") {
  const match = /const\s+PUSH_EVENT_KINDS\s*=\s*new\s+Set\s*\(\s*\[([\s\S]*?)\]\s*\)/.exec(text);
  if (!match) return [];
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
}

const files = readFiles(walk(root));
const result = verifyCanonicalEventCatalog({
  files,
  runtimeNotificationKinds: NOTIFICATION_KIND_IDS,
  runtimePushKinds: pushKindsFromSource(files["src/pushNotificationModel.js"] || "")
});

console.log(stableEventCatalogJson(result));
process.exitCode = result.ok ? 0 : 1;
