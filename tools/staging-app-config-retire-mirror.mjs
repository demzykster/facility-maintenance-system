#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { APP_CONFIG_ID, APP_CONFIG_KEY } from "../src/appConfigRecordModel.js";
import { appConfigMirrorRetirementPlan } from "../src/appConfigMirrorRetirementModel.js";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";

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
  const response = await fetch(`${root}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(select)}${query}`, {
    headers: serviceHeaders(serviceRoleKey)
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `${table}_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function deleteMirror({ root, serviceRoleKey }) {
  const response = await fetch(`${root}/rest/v1/cmms_kv_records?scope=eq.shared&record_key=eq.${encodeURIComponent(APP_CONFIG_KEY)}`, {
    method: "DELETE",
    headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" })
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `delete_app_config_mirror_${response.status}`);
}

loadEnvFile(ENV_FILE);

const apply = new Set(process.argv.slice(2)).has("--apply");
const root = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const [kvRows, configRows] = await Promise.all([
  serviceRows({
    root,
    serviceRoleKey,
    table: "cmms_kv_records",
    select: "scope,record_key,value",
    query: `&scope=eq.shared&record_key=eq.${encodeURIComponent(APP_CONFIG_KEY)}`
  }),
  serviceRows({
    root,
    serviceRoleKey,
    table: "app_config",
    select: "id,config,legacy_payload",
    query: `&id=eq.${encodeURIComponent(APP_CONFIG_ID)}&limit=1`
  })
]);

const plan = appConfigMirrorRetirementPlan({ kvRow: kvRows[0] || null, normalizedRow: configRows[0] || null });
let deleted = 0;

if (apply) {
  if (!plan.canDelete) throw new Error("app_config_mirror_retirement_blocked");
  await deleteMirror({ root, serviceRoleKey });
  deleted = 1;
}

console.log(JSON.stringify({
  ok: true,
  mode: apply ? "apply" : "dry-run",
  ...plan,
  deleted,
  checkedAt: new Date().toISOString()
}, null, 2));
