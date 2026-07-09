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

function parseKvFleet(records = []) {
  return records.map((record) => {
    try {
      const unit = JSON.parse(record.value);
      return unit?.id ? unit : null;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function kvFleet({ publicUrl, accessToken }) {
  const response = await fetch(`${publicUrl}/api/kv?prefix=fleet%3A&shared=1&includeValues=1`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error || `kv_fleet_${response.status}`);
  return parseKvFleet(data?.records || []);
}

async function normalizedFleetRows({ root, serviceRoleKey }) {
  const response = await fetch(`${root}/rest/v1/fleet_units?select=id,source_kv_key,legacy_payload`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `fleet_units_table_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function upsertFleet({ publicUrl, accessToken, unit }) {
  const response = await fetch(`${publicUrl}/api/fleet`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ unit })
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `fleet_upsert_${response.status}`);
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

const kv = await kvFleet({ publicUrl, accessToken });
const beforeRows = await normalizedFleetRows({ root: supabaseUrl, serviceRoleKey });
const beforeById = new Map(beforeRows.map((row) => [row.id, row]));
const toBackfill = kv.filter((unit) => {
  const row = beforeById.get(unit.id);
  return !row || stableStringify(row.legacy_payload || {}) !== stableStringify(unit);
});

for (const unit of toBackfill) {
  await upsertFleet({ publicUrl, accessToken, unit });
}

const afterRows = await normalizedFleetRows({ root: supabaseUrl, serviceRoleKey });
const afterById = new Map(afterRows.map((row) => [row.id, row]));
const missing = kv.filter((unit) => !afterById.has(unit.id)).map((unit) => unit.id);
const mismatched = kv.filter((unit) => {
  const row = afterById.get(unit.id);
  return row && stableStringify(row.legacy_payload || {}) !== stableStringify(unit);
}).map((unit) => unit.id);

if (missing.length || mismatched.length) {
  throw new Error(`fleet_reconcile_failed:missing=${missing.join(",") || "-"};mismatched=${mismatched.join(",") || "-"}`);
}

console.log(JSON.stringify({
  ok: true,
  appUrl: publicUrl,
  kvFleet: kv.length,
  normalizedFleet: afterRows.length,
  backfilled: toBackfill.length
}, null, 2));
