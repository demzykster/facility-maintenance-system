import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { STAGING_SUPABASE_TABLES, normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";

const ENV_FILE = ".env.staging.local";
const OUT_DIR = ".tools";

function loadEnvFile(file) {
  if (!existsSync(file)) return false;
  applyEnvValues(process.env, parseEnvFile(readFileSync(file, "utf8")));
  return true;
}

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function serviceHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json"
  };
}

async function fetchAllRows({ root, serviceRoleKey, table }) {
  const response = await fetch(`${root}/rest/v1/${encodeURIComponent(table)}?select=*`, {
    headers: {
      ...serviceHeaders(serviceRoleKey),
      prefer: "count=exact"
    }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(`table_export_failed:${table}:${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function listStoragePrefix({ root, serviceRoleKey, bucket, prefix = "" }) {
  const response = await fetch(`${root}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
    method: "POST",
    headers: serviceHeaders(serviceRoleKey),
    body: JSON.stringify({
      prefix,
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" }
    })
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(`storage_list_failed:${prefix || "/"}:${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function listStorageTree({ root, serviceRoleKey, bucket }) {
  const queue = [""];
  const files = [];

  while (queue.length) {
    const prefix = queue.shift();
    const entries = await listStoragePrefix({ root, serviceRoleKey, bucket, prefix });
    for (const entry of entries) {
      const name = String(entry?.name || "");
      if (!name || name === ".emptyFolderPlaceholder") continue;
      const path = prefix ? `${prefix.replace(/\/+$/, "")}/${name}` : name;
      if (entry?.id === null || entry?.metadata === null) {
        queue.push(path);
      } else {
        files.push({
          path,
          id: entry.id || "",
          updatedAt: entry.updated_at || entry.created_at || "",
          size: entry.metadata?.size || 0,
          mimetype: entry.metadata?.mimetype || entry.metadata?.cacheControl || ""
        });
      }
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function summarizeKv(rows = []) {
  return rows.reduce((acc, row) => {
    const key = String(row?.record_key || "");
    const prefix = key.includes(":") ? key.split(":")[0] : "unknown";
    acc[prefix] = (acc[prefix] || 0) + 1;
    return acc;
  }, {});
}

loadEnvFile(ENV_FILE);

const root = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const bucket = requireEnv("CMMS_FILE_BUCKET");
const projectRef = root.match(/^https:\/\/([^.]+)\.supabase\.co$/)?.[1] || "unknown";

const tables = {};
for (const table of STAGING_SUPABASE_TABLES) {
  tables[table] = await fetchAllRows({ root, serviceRoleKey, table });
}

const storageFiles = await listStorageTree({ root, serviceRoleKey, bucket });
const exportedAt = new Date().toISOString();
const evidence = {
  exportedAt,
  projectRef,
  bucket,
  summary: {
    tables: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])),
    kvPrefixes: summarizeKv(tables.cmms_kv_records),
    storageFiles: storageFiles.length
  },
  tables,
  storageFiles
};

mkdirSync(OUT_DIR, { recursive: true });
const stamp = exportedAt.replace(/[:.]/g, "-");
const file = join(OUT_DIR, `staging-backup-evidence-${stamp}.json`);
writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);

console.log("[staging-backup-evidence] wrote", file);
console.log(JSON.stringify(evidence.summary, null, 2));
