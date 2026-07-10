#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";

const ENV_FILE = ".env.staging.local";
const CREDENTIALS_FILE = ".staging-admin-credentials.local";
const DEFAULT_APP_URL = "https://facility-maintenance-system.vercel.app";
const now = Date.now();
const id = `smoke-presence-${now}-${Math.random().toString(36).slice(2, 8)}`;

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
  const response = await fetch(`${root}/rest/v1/technician_presence?id=eq.${encodeURIComponent(recordId)}&select=id,source_kv_key`, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `technician_presence_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function upsert({ publicUrl, accessToken, presence }) {
  const response = await fetch(`${publicUrl}/api/presence`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ presence })
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `presence_upsert_${response.status}`);
}

async function list({ publicUrl, accessToken }) {
  const response = await fetch(`${publicUrl}/api/presence`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `presence_list_${response.status}`);
  return Array.isArray(data?.presence) ? data.presence : [];
}

async function remove({ publicUrl, accessToken, recordId }) {
  const response = await fetch(`${publicUrl}/api/presence?id=${encodeURIComponent(recordId)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `presence_delete_${response.status}`);
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
const presence = {
  id,
  name: "Presence Smoke",
  onShift: true,
  since: now,
  lastSeen: now,
  day: new Date(now).toISOString().slice(0, 10)
};

try {
  await upsert({ publicUrl, accessToken, presence });
  const afterUpsert = await rows({ root: supabaseUrl, serviceRoleKey, recordId: id });
  if (afterUpsert.length !== 1) throw new Error(`presence_upsert_row_count:${afterUpsert.length}`);
  const listed = await list({ publicUrl, accessToken });
  if (!listed.some((record) => record.id === id)) throw new Error("presence_list_missing_smoke_record");
  await remove({ publicUrl, accessToken, recordId: id });
  const afterDelete = await rows({ root: supabaseUrl, serviceRoleKey, recordId: id });
  if (afterDelete.length !== 0) throw new Error(`presence_delete_row_count:${afterDelete.length}`);

  console.log(JSON.stringify({
    ok: true,
    appUrl: publicUrl,
    presence: { id, upserted: true, listed: true, deleted: true }
  }, null, 2));
} catch (error) {
  try {
    await fetch(`${publicUrl}/api/presence?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` }
    });
  } catch {}
  throw error;
}
