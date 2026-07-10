#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { APP_CONFIG_ID, APP_CONFIG_KEY } from "../src/appConfigRecordModel.js";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";

const ENV_FILE = ".env.staging.local";
const CREDENTIALS_FILE = ".staging-admin-credentials.local";
const DEFAULT_APP_URL = "https://facility-maintenance-system.vercel.app";

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  applyEnvValues(process.env, parseEnvFile(readFileSync(file, "utf8")));
}

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function appUrl() {
  return String(process.env.CMMS_STAGING_APP_URL || process.env.STAGING_APP_URL || DEFAULT_APP_URL).replace(/\/+$/, "");
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

async function supabasePasswordToken({ url, anonKey, email, password }) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error_description || data?.msg || data?.message || `auth_${response.status}`);
  if (!data?.access_token) throw new Error("auth_access_token_missing");
  return data.access_token;
}

function sortedJson(value) {
  if (Array.isArray(value)) return value.map(sortedJson);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedJson(value[key])]));
  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortedJson(value || {}));
}

function parseConfig(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  return JSON.parse(raw);
}

async function kvGet({ publicUrl, accessToken }) {
  const response = await fetch(`${publicUrl}/api/kv/${encodeURIComponent(APP_CONFIG_KEY)}?shared=1`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error || `kv_config_${response.status}`);
  return parseConfig(data?.value || "{}");
}

async function normalizedRow({ root, serviceRoleKey }) {
  const response = await fetch(`${root}/rest/v1/app_config?id=eq.${encodeURIComponent(APP_CONFIG_ID)}&select=id,config,legacy_payload&limit=1`, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `app_config_${response.status}`);
  return Array.isArray(data) && data[0] ? data[0] : null;
}

async function upsertConfig({ publicUrl, accessToken, config }) {
  const response = await fetch(`${publicUrl}/api/settings/config`, {
    method: "PUT",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ config })
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `app_config_upsert_${response.status}`);
}

loadEnvFile(ENV_FILE);
loadEnvFile(CREDENTIALS_FILE);

const publicUrl = appUrl();
const supabaseUrl = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
const anonKey = requireEnv("SUPABASE_ANON_KEY");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const adminEmail = String(process.env.STAGING_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.STAGING_ADMIN_PASSWORD || process.env.ADMIN_NEW_PASSWORD || "").trim();

if (!adminEmail || !adminPassword) throw new Error("missing_admin_credentials");

const accessToken = await supabasePasswordToken({ url: supabaseUrl, anonKey, email: adminEmail, password: adminPassword });
const kvConfig = await kvGet({ publicUrl, accessToken });
const before = await normalizedRow({ root: supabaseUrl, serviceRoleKey });
const needsBackfill = !before || stableStringify(before.config || before.legacy_payload || {}) !== stableStringify(kvConfig);

if (needsBackfill) await upsertConfig({ publicUrl, accessToken, config: kvConfig });

const after = await normalizedRow({ root: supabaseUrl, serviceRoleKey });
if (!after) throw new Error("app_config_reconcile_missing");
if (stableStringify(after.config || after.legacy_payload || {}) !== stableStringify(kvConfig)) throw new Error("app_config_reconcile_mismatched");

console.log(JSON.stringify({
  ok: true,
  appUrl: publicUrl,
  appConfig: { kv: Object.keys(kvConfig).length ? 1 : 0, normalized: 1, backfilled: needsBackfill ? 1 : 0 }
}, null, 2));
