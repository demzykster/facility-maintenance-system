#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { STAGING_SUPABASE_TABLES, normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";

const ENV_FILE = ".env.staging.local";

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

function serviceHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
    ...extra
  };
}

async function tableCount({ root, serviceRoleKey, table }) {
  const response = await fetch(`${root}/rest/v1/${encodeURIComponent(table)}?select=*`, {
    method: "HEAD",
    headers: serviceHeaders(serviceRoleKey, { prefer: "count=exact" })
  });
  if (!response.ok) throw new Error(`table_count_failed:${table}:${response.status}`);
  return Number(response.headers.get("content-range")?.split("/")?.pop() || 0);
}

async function kvPrefixCounts({ root, serviceRoleKey }) {
  const response = await fetch(`${root}/rest/v1/cmms_kv_records?select=record_key`, {
    headers: serviceHeaders(serviceRoleKey)
  });
  const rows = await readJson(response);
  if (!response.ok) throw new Error(`kv_prefix_count_failed:${response.status}`);
  return (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    const key = String(row?.record_key || "");
    const prefix = key.includes(":") ? key.split(":")[0] : "unknown";
    acc[prefix] = (acc[prefix] || 0) + 1;
    return acc;
  }, {});
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

async function storageSummary({ root, serviceRoleKey, bucket }) {
  const queue = [""];
  let files = 0;
  let bytes = 0;
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
        files += 1;
        bytes += Number(entry.metadata?.size || 0);
      }
    }
  }
  return { files, bytes };
}

loadEnvFile(ENV_FILE);

const root = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const bucket = requireEnv("CMMS_FILE_BUCKET");
const projectRef = root.match(/^https:\/\/([^.]+)\.supabase\.co$/)?.[1] || "unknown";

const tables = {};
for (const table of STAGING_SUPABASE_TABLES) {
  tables[table] = await tableCount({ root, serviceRoleKey, table });
}

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  projectRef,
  tables,
  kvPrefixes: await kvPrefixCounts({ root, serviceRoleKey }),
  storage: await storageSummary({ root, serviceRoleKey, bucket })
};

console.log(JSON.stringify(summary, null, 2));
