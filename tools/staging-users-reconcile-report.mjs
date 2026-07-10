#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
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

const serviceHeaders = (serviceRoleKey, extra = {}) => ({
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
  ...extra
});

async function serviceRows({ root, serviceRoleKey, table, select = "*", query = "" }) {
  const response = await fetch(`${root}/rest/v1/${table}?select=${encodeURIComponent(select)}${query}`, {
    headers: serviceHeaders(serviceRoleKey)
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `${table}_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function serviceInsertRows({ root, serviceRoleKey, table, rows }) {
  if (!rows.length) return [];
  const response = await fetch(`${root}/rest/v1/${table}`, {
    method: "POST",
    headers: serviceHeaders(serviceRoleKey, { prefer: "return=representation" }),
    body: JSON.stringify(rows)
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `${table}_insert_${response.status}`);
  return Array.isArray(data) ? data : [];
}

loadEnvFile(ENV_FILE);

const root = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const apply = process.argv.includes("--apply");

const [legacyRows, appUsers] = await Promise.all([
  serviceRows({
    root,
    serviceRoleKey,
    table: "cmms_kv_records",
    select: "record_key,value",
    query: `&scope=eq.shared&record_key=like.${encodeURIComponent("user:%")}&order=record_key.asc`
  }),
  serviceRows({
    root,
    serviceRoleKey,
    table: "app_users",
    select: "id,auth_user_id,email,worker_no,phone,role,name,active,login_state",
    query: "&order=name.asc"
  })
]);

const report = proposeLegacyUserBackfillRows({ legacyRows, appUsers });
if (apply && (report.counts.ambiguous > 0 || report.counts.parseErrors > 0 || report.counts.skippedBackfill > 0)) {
  throw new Error(`backfill_not_safe:${JSON.stringify({
    ambiguous: report.counts.ambiguous,
    parseErrors: report.counts.parseErrors,
    skippedBackfill: report.counts.skippedBackfill
  })}`);
}

let inserted = [];
let after = null;
if (apply && report.proposedBackfill.length) {
  inserted = await serviceInsertRows({
    root,
    serviceRoleKey,
    table: "app_users",
    rows: report.proposedBackfill.map((item) => item.row)
  });
  const nextAppUsers = await serviceRows({
    root,
    serviceRoleKey,
    table: "app_users",
    select: "id,auth_user_id,email,worker_no,phone,role,name,active,login_state",
    query: "&order=name.asc"
  });
  after = proposeLegacyUserBackfillRows({ legacyRows, appUsers: nextAppUsers });
}

console.log(JSON.stringify({
  ...report,
  applied: apply,
  inserted: inserted.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    hasEmail: !!row.email,
    hasWorkerNo: !!row.worker_no,
    hasPhone: !!row.phone,
    loginState: row.login_state
  })),
  after,
  checkedAt: new Date().toISOString(),
  mode: apply ? "apply" : "dry-run"
}, null, 2));
