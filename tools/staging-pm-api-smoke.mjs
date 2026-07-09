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

async function pmRows({ root, serviceRoleKey, id }) {
  const response = await fetch(`${root}/rest/v1/periodic_maintenance?id=eq.${encodeURIComponent(id)}&select=id,title,fleet_unit_id,source_kv_key`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `periodic_maintenance_table_${response.status}`);
  return Array.isArray(data) ? data : [];
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

const id = `smoke-pm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const title = `Smoke PM ${Date.now()}`;
const task = {
  id,
  forkliftId: "smoke-fleet",
  title,
  frequency: "monthly",
  active: true,
  nextDue: Date.now() + 86400000,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

try {
  const upsertResponse = await fetch(`${publicUrl}/api/pm`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ task })
  });
  const upsertData = await readJson(upsertResponse);
  if (!upsertResponse.ok || !upsertData?.ok) throw new Error(upsertData?.error || `pm_upsert_${upsertResponse.status}`);

  const afterUpsert = await pmRows({ root: supabaseUrl, serviceRoleKey, id });
  if (afterUpsert.length !== 1) throw new Error(`pm_upsert_row_count:${afterUpsert.length}`);
  if (afterUpsert[0].title !== title) throw new Error("pm_upsert_title_mismatch");

  const listResponse = await fetch(`${publicUrl}/api/pm`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const listData = await readJson(listResponse);
  if (!listResponse.ok || !listData?.ok) throw new Error(listData?.error || `pm_list_${listResponse.status}`);
  if (!listData?.tasks?.some((item) => item.id === id && item.title === title)) throw new Error("pm_list_missing_smoke_task");

  const deleteResponse = await fetch(`${publicUrl}/api/pm?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const deleteData = await readJson(deleteResponse);
  if (!deleteResponse.ok || !deleteData?.ok) throw new Error(deleteData?.error || `pm_delete_${deleteResponse.status}`);

  const afterDelete = await pmRows({ root: supabaseUrl, serviceRoleKey, id });
  if (afterDelete.length !== 0) throw new Error(`pm_delete_row_count:${afterDelete.length}`);

  console.log(JSON.stringify({
    ok: true,
    appUrl: publicUrl,
    pm: {
      id,
      upserted: true,
      listed: true,
      deleted: true
    }
  }, null, 2));
} catch (error) {
  try {
    await fetch(`${publicUrl}/api/pm?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` }
    });
  } catch {}
  throw error;
}
