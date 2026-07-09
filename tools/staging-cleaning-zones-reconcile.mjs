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

function parseKvCleaningZones(records = []) {
  return records.map((record) => {
    try {
      const zone = JSON.parse(record.value);
      return zone?.id ? zone : null;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function kvCleaningZones({ publicUrl, accessToken }) {
  const response = await fetch(`${publicUrl}/api/kv?prefix=czone%3A&shared=1&includeValues=1`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error || `kv_cleaning_zones_${response.status}`);
  return parseKvCleaningZones(data?.records || []);
}

async function normalizedCleaningZoneRows({ root, serviceRoleKey }) {
  const response = await fetch(`${root}/rest/v1/cleaning_zones?select=id,source_kv_key,legacy_payload`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `cleaning_zones_table_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function upsertCleaningZone({ publicUrl, accessToken, zone }) {
  const response = await fetch(`${publicUrl}/api/cleaning/zones`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ zone })
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `cleaning_zone_upsert_${response.status}`);
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

const kv = await kvCleaningZones({ publicUrl, accessToken });
const beforeRows = await normalizedCleaningZoneRows({ root: supabaseUrl, serviceRoleKey });
const beforeById = new Map(beforeRows.map((row) => [row.id, row]));
const toBackfill = kv.filter((zone) => {
  const row = beforeById.get(zone.id);
  return !row || stableStringify(row.legacy_payload || {}) !== stableStringify(zone);
});

for (const zone of toBackfill) {
  await upsertCleaningZone({ publicUrl, accessToken, zone });
}

const afterRows = await normalizedCleaningZoneRows({ root: supabaseUrl, serviceRoleKey });
const afterById = new Map(afterRows.map((row) => [row.id, row]));
const missing = kv.filter((zone) => !afterById.has(zone.id)).map((zone) => zone.id);
const mismatched = kv.filter((zone) => {
  const row = afterById.get(zone.id);
  return row && stableStringify(row.legacy_payload || {}) !== stableStringify(zone);
}).map((zone) => zone.id);

if (missing.length || mismatched.length) {
  throw new Error(`cleaning_zones_reconcile_failed:missing=${missing.join(",") || "-"};mismatched=${mismatched.join(",") || "-"}`);
}

console.log(JSON.stringify({
  ok: true,
  appUrl: publicUrl,
  kvCleaningZones: kv.length,
  normalizedCleaningZones: afterRows.length,
  backfilled: toBackfill.length
}, null, 2));
