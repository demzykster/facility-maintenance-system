#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { DATA_COLLECTIONS } from "../src/dataCollections.js";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { kvMirrorRetirementPlan } from "../src/kvMirrorRetirementModel.js";
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

function argValue(name) {
  const args = process.argv.slice(2);
  const inlinePrefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || "") : "";
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

async function deleteKvRows({ root, serviceRoleKey, keys }) {
  if (!keys.length) return 0;
  let deleted = 0;
  for (let index = 0; index < keys.length; index += 50) {
    const chunk = keys.slice(index, index + 50);
    const query = `scope=eq.shared&record_key=in.(${chunk.map(encodeURIComponent).join(",")})`;
    const response = await fetch(`${root}/rest/v1/cmms_kv_records?${query}`, {
      method: "DELETE",
      headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" })
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data?.message || data?.error || `delete_kv_${response.status}`);
    deleted += chunk.length;
  }
  return deleted;
}

loadEnvFile(ENV_FILE);

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const prefix = argValue("--prefix");
if (!prefix) throw new Error("missing_arg:--prefix=<prefix>");
const collection = DATA_COLLECTIONS.find((item) => item.prefix === prefix);
if (!collection) throw new Error(`unknown_prefix:${prefix}`);

const root = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const [kvRows, normalizedRows] = await Promise.all([
  serviceRows({
    root,
    serviceRoleKey,
    table: "cmms_kv_records",
    select: "scope,record_key,value",
    query: `&scope=eq.shared&record_key=like.${encodeURIComponent(`${prefix}%`)}&order=record_key.asc`
  }),
  serviceRows({
    root,
    serviceRoleKey,
    table: collection.table,
    select: "id,source_kv_key",
    query: "&order=id.asc"
  })
]);

const plan = kvMirrorRetirementPlan({ prefix, kvRows, normalizedRows });
const deleted = apply ? await deleteKvRows({ root, serviceRoleKey, keys: plan.matched }) : 0;

console.log(JSON.stringify({
  ok: true,
  mode: apply ? "apply" : "dry-run",
  collection: collection.key,
  table: collection.table,
  ...plan,
  deleted,
  checkedAt: new Date().toISOString()
}, null, 2));
