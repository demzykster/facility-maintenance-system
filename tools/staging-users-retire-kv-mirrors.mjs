#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";
import { planRetiredUserKvDeletion } from "../src/userKvRetirementModel.js";

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

async function deleteKvRecord({ root, serviceRoleKey, key }) {
  const response = await fetch(`${root}/rest/v1/cmms_kv_records?scope=eq.shared&record_key=eq.${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: serviceHeaders(serviceRoleKey)
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `delete_${key}_${response.status}`);
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

const plan = planRetiredUserKvDeletion({ legacyRows, appUsers });
if (apply && !plan.ok) {
  throw new Error(`user_kv_retirement_not_safe:${JSON.stringify(plan.blockers)}`);
}

let deleted = 0;
if (apply) {
  for (const key of plan.keys) {
    await deleteKvRecord({ root, serviceRoleKey, key });
    deleted += 1;
  }
}

console.log(JSON.stringify({
  ok: plan.ok,
  mode: apply ? "apply" : "dry-run",
  blockers: plan.blockers,
  counts: {
    legacyUsers: plan.report.legacyUsers,
    appUsers: plan.report.appUsers,
    matched: plan.report.matched.length,
    ambiguous: plan.report.ambiguous.length,
    legacyOnly: plan.report.legacyOnly.length,
    parseErrors: plan.report.parseErrors.length,
    deletable: plan.keys.length
  },
  keys: plan.keys,
  deleted,
  checkedAt: new Date().toISOString()
}, null, 2));
