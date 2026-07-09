#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
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

const sortedJson = (value) => {
  if (Array.isArray(value)) return value.map(sortedJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedJson(value[key])]));
  }
  return value;
};

const stableStringify = (value) => JSON.stringify(sortedJson(value));

function parseKvPm(records = []) {
  return records.map((record) => {
    try {
      const task = JSON.parse(record.value);
      return task?.id ? task : null;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function kvPm({ publicUrl, accessToken }) {
  const response = await fetch(`${publicUrl}/api/kv?prefix=pm%3A&shared=1&includeValues=1`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error || `kv_pm_${response.status}`);
  return parseKvPm(data?.records || []);
}

async function normalizedPmRows({ root, serviceRoleKey }) {
  const response = await fetch(`${root}/rest/v1/periodic_maintenance?select=id,source_kv_key,legacy_payload`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `periodic_maintenance_table_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function upsertPm({ publicUrl, accessToken, task }) {
  const response = await fetch(`${publicUrl}/api/pm`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ task })
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `pm_upsert_${response.status}`);
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

const accessToken = await supabasePasswordToken({
  url: supabaseUrl,
  anonKey,
  email: adminEmail,
  password: adminPassword
});

const kv = await kvPm({ publicUrl, accessToken });
const beforeRows = await normalizedPmRows({ root: supabaseUrl, serviceRoleKey });
const beforeById = new Map(beforeRows.map((row) => [row.id, row]));
const toBackfill = kv.filter((task) => {
  const row = beforeById.get(task.id);
  return !row || stableStringify(row.legacy_payload || {}) !== stableStringify(task);
});

for (const task of toBackfill) {
  await upsertPm({ publicUrl, accessToken, task });
}

const afterRows = await normalizedPmRows({ root: supabaseUrl, serviceRoleKey });
const afterById = new Map(afterRows.map((row) => [row.id, row]));
const missing = kv.filter((task) => !afterById.has(task.id)).map((task) => task.id);
const mismatched = kv.filter((task) => {
  const row = afterById.get(task.id);
  return row && stableStringify(row.legacy_payload || {}) !== stableStringify(task);
}).map((task) => task.id);

if (missing.length || mismatched.length) {
  throw new Error(`pm_reconcile_failed:missing=${missing.join(",") || "-"};mismatched=${mismatched.join(",") || "-"}`);
}

console.log(JSON.stringify({
  ok: true,
  appUrl: publicUrl,
  kvPm: kv.length,
  normalizedPm: afterRows.length,
  backfilled: toBackfill.length
}, null, 2));
