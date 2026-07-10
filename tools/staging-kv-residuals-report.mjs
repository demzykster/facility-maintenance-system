#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { classifyKvResiduals, countKvPrefixes, countKvScopes } from "../src/kvResidualsModel.js";
import { normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";
import { proposeLegacyUserBackfillRows } from "../src/userReconciliationModel.js";

const ENV_FILE = ".env.staging.local";

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  applyEnvValues(process.env, parseEnvFile(readFileSync(file, "utf8")));
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

const serviceHeaders = (serviceRoleKey) => ({
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json"
});

async function serviceRows({ root, serviceRoleKey, table, select = "*", query = "" }) {
  const response = await fetch(`${root}/rest/v1/${table}?select=${encodeURIComponent(select)}${query}`, {
    headers: serviceHeaders(serviceRoleKey)
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `${table}_${response.status}`);
  return Array.isArray(data) ? data : [];
}

loadEnvFile(ENV_FILE);

const root = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const [kvRows, appUsers] = await Promise.all([
  serviceRows({
    root,
    serviceRoleKey,
    table: "cmms_kv_records",
    select: "scope,record_key,value",
    query: "&order=scope.asc,record_key.asc"
  }),
  serviceRows({
    root,
    serviceRoleKey,
    table: "app_users",
    select: "id,auth_user_id,email,worker_no,phone,role,name,active,login_state",
    query: "&order=name.asc"
  })
]);

const userRows = kvRows.filter((row) => String(row.record_key || "").startsWith("user:"));
const userReconciliation = proposeLegacyUserBackfillRows({ legacyRows: userRows, appUsers });
const report = classifyKvResiduals({
  kvPrefixes: countKvPrefixes(kvRows.map((row) => row.record_key)),
  kvScopes: countKvScopes(kvRows),
  userReconciliation
});

console.log(JSON.stringify({
  ...report,
  userReconciliation: userReconciliation.counts,
  checkedAt: new Date().toISOString(),
  mode: "read-only"
}, null, 2));
