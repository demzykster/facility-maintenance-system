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

async function configGet({ publicUrl, token }) {
  const response = await fetch(`${publicUrl}/api/settings/config`, {
    headers: { authorization: `Bearer ${token}` }
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `app_config_get_${response.status}`);
  return data?.config || {};
}

async function configSet({ publicUrl, token, config }) {
  const response = await fetch(`${publicUrl}/api/settings/config`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ config })
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `app_config_set_${response.status}`);
  return data?.config || {};
}

loadEnvFile(ENV_FILE);
loadEnvFile(CREDENTIALS_FILE);

const publicUrl = appUrl();
const supabaseUrl = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
const anonKey = requireEnv("SUPABASE_ANON_KEY");
const adminEmail = String(process.env.STAGING_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.STAGING_ADMIN_PASSWORD || process.env.ADMIN_NEW_PASSWORD || "").trim();

if (!adminEmail || !adminPassword) throw new Error("missing_admin_credentials");

const token = await supabasePasswordToken({ url: supabaseUrl, anonKey, email: adminEmail, password: adminPassword });
const original = await configGet({ publicUrl, token });
const marker = `app-config-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let restoreNeeded = false;
try {
  await configSet({ publicUrl, token, config: { ...original, __appConfigSmoke: { marker, at: new Date().toISOString() } } });
  restoreNeeded = true;
  const saved = await configGet({ publicUrl, token });
  if (saved?.__appConfigSmoke?.marker !== marker) throw new Error("app_config_marker_not_persisted");
} finally {
  if (restoreNeeded) await configSet({ publicUrl, token, config: original });
}

const restored = await configGet({ publicUrl, token });
if (restored?.__appConfigSmoke) throw new Error("app_config_marker_not_restored");

console.log(JSON.stringify({ ok: true, appUrl: publicUrl, appConfig: { updated: true, restored: true } }, null, 2));
