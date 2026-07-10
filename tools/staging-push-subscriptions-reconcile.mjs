#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { parsePushSubscriptions, PUSH_SUBSCRIPTIONS_KEY } from "../src/pushNotificationModel.js";
import { pushSubscriptionRecordToSupabaseRow } from "../src/pushSubscriptionRecordModel.js";
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

async function kvSubscriptions({ publicUrl, accessToken }) {
  const response = await fetch(`${publicUrl}/api/kv/${encodeURIComponent(PUSH_SUBSCRIPTIONS_KEY)}?shared=1`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error || `kv_push_subscriptions_${response.status}`);
  return parsePushSubscriptions(data?.value || []);
}

async function normalizedRows({ root, serviceRoleKey }) {
  const response = await fetch(`${root}/rest/v1/push_subscriptions?select=id,legacy_payload`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `push_subscriptions_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function upsertRows({ root, serviceRoleKey, records }) {
  if (!records.length) return;
  const response = await fetch(`${root}/rest/v1/push_subscriptions?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(records.map(pushSubscriptionRecordToSupabaseRow))
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `push_subscriptions_upsert_${response.status}`);
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
const kv = await kvSubscriptions({ publicUrl, accessToken });
const beforeRows = await normalizedRows({ root: supabaseUrl, serviceRoleKey });
const beforeIds = new Set(beforeRows.map((row) => row.id));
const toBackfill = kv.filter((record) => !beforeIds.has(record.id));

await upsertRows({ root: supabaseUrl, serviceRoleKey, records: toBackfill });

const afterRows = await normalizedRows({ root: supabaseUrl, serviceRoleKey });
const afterIds = new Set(afterRows.map((row) => row.id));
const missing = kv.filter((record) => !afterIds.has(record.id)).map((record) => record.id);

if (missing.length) {
  throw new Error(`push_subscriptions_reconcile_failed:missing=${missing.join(",")}`);
}

console.log(JSON.stringify({
  ok: true,
  appUrl: publicUrl,
  pushSubscriptions: { kv: kv.length, normalized: afterRows.length, backfilled: toBackfill.length }
}, null, 2));
