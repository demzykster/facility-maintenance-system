#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";

const ENV_FILE = ".env.staging.local";
const CREDENTIALS_FILE = ".staging-admin-credentials.local";
const DEFAULT_APP_URL = "https://facility-maintenance-system.vercel.app";

const RESOURCES = Object.freeze({
  complaints: { kvPrefix: "ccomplaint:", table: "cleaning_complaints", apiResource: "complaints", apiBodyKey: "complaint" },
  absences: { kvPrefix: "cabsence:", table: "worker_absences", apiResource: "absences", apiBodyKey: "absence" }
});

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
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedJson(value[key])]));
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortedJson(value));
}

function parseKvRecords(records = []) {
  return records.map((record) => {
    try {
      const parsed = JSON.parse(record.value);
      return parsed?.id ? parsed : null;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function kvRecords({ publicUrl, accessToken, prefix }) {
  const response = await fetch(`${publicUrl}/api/kv?prefix=${encodeURIComponent(prefix)}&shared=1&includeValues=1`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error || `kv_records_${prefix}_${response.status}`);
  return parseKvRecords(data?.records || []);
}

async function normalizedRows({ root, serviceRoleKey, table }) {
  const response = await fetch(`${root}/rest/v1/${table}?select=id,source_kv_key,legacy_payload`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `${table}_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function upsertRecord({ publicUrl, accessToken, resource, bodyKey, record }) {
  const response = await fetch(`${publicUrl}/api/cleaning/records`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ resource, [bodyKey]: record })
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `cleaning_record_upsert_${resource}_${response.status}`);
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

const results = {};

for (const [name, config] of Object.entries(RESOURCES)) {
  const kv = await kvRecords({ publicUrl, accessToken, prefix: config.kvPrefix });
  const beforeRows = await normalizedRows({ root: supabaseUrl, serviceRoleKey, table: config.table });
  const beforeById = new Map(beforeRows.map((row) => [row.id, row]));
  const toBackfill = kv.filter((record) => {
    const row = beforeById.get(record.id);
    return !row || stableStringify(row.legacy_payload || {}) !== stableStringify(record);
  });

  for (const record of toBackfill) {
    await upsertRecord({
      publicUrl,
      accessToken,
      resource: config.apiResource,
      bodyKey: config.apiBodyKey,
      record
    });
  }

  const afterRows = await normalizedRows({ root: supabaseUrl, serviceRoleKey, table: config.table });
  const afterById = new Map(afterRows.map((row) => [row.id, row]));
  const missing = kv.filter((record) => !afterById.has(record.id)).map((record) => record.id);
  const mismatched = kv.filter((record) => {
    const row = afterById.get(record.id);
    return row && stableStringify(row.legacy_payload || {}) !== stableStringify(record);
  }).map((record) => record.id);

  if (missing.length || mismatched.length) {
    throw new Error(`cleaning_${name}_reconcile_failed:missing=${missing.join(",") || "-"};mismatched=${mismatched.join(",") || "-"}`);
  }

  results[name] = {
    kv: kv.length,
    normalized: afterRows.length,
    backfilled: toBackfill.length
  };
}

console.log(JSON.stringify({
  ok: true,
  appUrl: publicUrl,
  ...results
}, null, 2));
