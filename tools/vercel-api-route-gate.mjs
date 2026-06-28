import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { vercelApiRoutePolicy } from "../src/vercelApiRouteModel.js";

function listJsFiles(dir, root = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...listJsFiles(path, root));
    else if (entry.endsWith(".js")) out.push(relative(root, path).replace(/\\/g, "/"));
  }
  return out;
}

const apiRoot = join(process.cwd(), "api");
const files = listJsFiles(apiRoot).map((file) => `api/${file}`);
const result = vercelApiRoutePolicy(files);

if (!result.ok) {
  console.error("[vercel-api-route] failed");
  for (const error of result.errors) console.error(`- ${error}`);
  console.error("Only real endpoint files should live under api/. Move helpers to server/.");
  process.exit(1);
}

console.log(`[vercel-api-route] ok: ${result.apiFiles.length}/${result.functionLimit} endpoint files`);
