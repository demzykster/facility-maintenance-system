import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import {
  STAGING_SUPABASE_TABLES,
  missingSupabaseSchemaEnv,
  normalizeSupabaseUrl,
  supabaseSchemaCheckSummary
} from "../src/supabaseStagingSchemaCheckModel.js";

if (existsSync(".env.staging.local")) {
  applyEnvValues(process.env, parseEnvFile(readFileSync(".env.staging.local", "utf8")));
}

const missing = missingSupabaseSchemaEnv(process.env);
if (missing.length) {
  console.error("[supabase-schema] preflight failed");
  for (const name of missing) console.error(`- missing_env:${name}`);
  process.exit(1);
}

const root = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const bucketName = String(process.env.CMMS_FILE_BUCKET || "").trim();
const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`
};

async function checkTable(name) {
  const response = await fetch(`${root}/rest/v1/${encodeURIComponent(name)}?select=*&limit=1`, { headers });
  return { name, ok: response.ok, status: response.status };
}

async function checkBucket(name) {
  const response = await fetch(`${root}/storage/v1/bucket/${encodeURIComponent(name)}`, { headers });
  let data = {};
  try { data = await response.json(); } catch {}
  return { name, ok: response.ok, private: data?.public === false, status: response.status };
}

const tables = [];
const errors = [];

for (const table of STAGING_SUPABASE_TABLES) {
  try {
    const result = await checkTable(table);
    tables.push(result);
    if (!result.ok) errors.push(`table_not_ready:${table}:${result.status}`);
  } catch {
    tables.push({ name: table, ok: false, status: "network_error" });
    errors.push(`table_not_ready:${table}:network_error`);
  }
}

let bucket = null;
try {
  bucket = await checkBucket(bucketName);
  if (!bucket.ok) errors.push(`bucket_not_ready:${bucketName}:${bucket.status}`);
  if (bucket.ok && !bucket.private) errors.push(`bucket_must_be_private:${bucketName}`);
} catch {
  bucket = { name: bucketName, ok: false, private: false, status: "network_error" };
  errors.push(`bucket_not_ready:${bucketName}:network_error`);
}

const summary = supabaseSchemaCheckSummary({ tables, bucket, errors });

if (!summary.ok) {
  console.error("[supabase-schema] preflight failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("[supabase-schema] preflight ok");
console.log(JSON.stringify(summary, null, 2));
