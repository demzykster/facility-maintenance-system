#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { pushSubscriptionId } from "../src/pushNotificationModel.js";
import { normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";

const ENV_FILE = ".env.staging.local";
const CREDENTIALS_FILE = ".staging-admin-credentials.local";
const DEFAULT_APP_URL = "https://facility-maintenance-system.vercel.app";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const subscription = {
  endpoint: `https://push-smoke.example/${suffix}`,
  keys: { p256dh: `p256-${suffix}`, auth: `auth-${suffix}` }
};
const id = pushSubscriptionId(subscription);

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

async function rows({ root, serviceRoleKey, recordId }) {
  const response = await fetch(`${root}/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(recordId)}&select=id,endpoint`, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `push_subscriptions_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function pushAction({ publicUrl, accessToken, action }) {
  const response = await fetch(`${publicUrl}/api/push`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ action, subscription })
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `push_${action}_${response.status}`);
  return data;
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

try {
  const subscribed = await pushAction({ publicUrl, accessToken, action: "subscribe" });
  if (subscribed.id !== id) throw new Error(`push_subscribe_id_mismatch:${subscribed.id}:${id}`);
  const afterSubscribe = await rows({ root: supabaseUrl, serviceRoleKey, recordId: id });
  if (afterSubscribe.length !== 1) throw new Error(`push_subscribe_row_count:${afterSubscribe.length}`);
  await pushAction({ publicUrl, accessToken, action: "unsubscribe" });
  const afterUnsubscribe = await rows({ root: supabaseUrl, serviceRoleKey, recordId: id });
  if (afterUnsubscribe.length !== 0) throw new Error(`push_unsubscribe_row_count:${afterUnsubscribe.length}`);

  console.log(JSON.stringify({
    ok: true,
    appUrl: publicUrl,
    pushSubscription: { id, subscribed: true, unsubscribed: true }
  }, null, 2));
} catch (error) {
  try {
    await pushAction({ publicUrl, accessToken, action: "unsubscribe" });
  } catch {}
  throw error;
}
