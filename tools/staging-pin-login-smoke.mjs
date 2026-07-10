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

const serviceHeaders = (serviceRoleKey, extra = {}) => ({
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
  ...extra
});

async function apiRequest({ publicUrl, path, body, token }) {
  const response = await fetch(`${publicUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await readJson(response);
  if (!response.ok || data?.ok === false) throw new Error(data?.error || `api_${response.status}`);
  return data;
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

async function apiGet({ publicUrl, path, token }) {
  const response = await fetch(`${publicUrl}${path}`, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` }
  });
  const data = await readJson(response);
  if (!response.ok || data?.ok === false) throw new Error(data?.error || `api_${response.status}`);
  return data;
}

async function serviceRows({ root, serviceRoleKey, table, select = "*", query = "" }) {
  const response = await fetch(`${root}/rest/v1/${table}?select=${encodeURIComponent(select)}${query}`, {
    headers: serviceHeaders(serviceRoleKey)
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `${table}_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function serviceDelete({ root, serviceRoleKey, table, query }) {
  await fetch(`${root}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" })
  });
}

loadEnvFile(ENV_FILE);
loadEnvFile(CREDENTIALS_FILE);

const publicUrl = appUrl();
const supabaseUrl = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
const anonKey = requireEnv("SUPABASE_ANON_KEY");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const adminEmail = String(process.env.STAGING_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.STAGING_ADMIN_PASSWORD || process.env.ADMIN_NEW_PASSWORD || "").trim();
const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
const workerNo = `88${suffix.slice(-8)}`;
const pin = "6842";
let appUserId = "";

if (!adminEmail || !adminPassword) throw new Error("missing_admin_credentials");

try {
  const adminAccessToken = await supabasePasswordToken({
    url: supabaseUrl,
    anonKey,
    email: adminEmail,
    password: adminPassword
  });

  const insertResponse = await fetch(`${supabaseUrl}/rest/v1/app_users`, {
    method: "POST",
    headers: serviceHeaders(serviceRoleKey, { prefer: "return=representation" }),
    body: JSON.stringify({
      role: "worker",
      name: "Smoke PIN Worker",
      worker_no: workerNo,
      department: "Smoke",
      departments: ["Smoke"],
      active: true,
      permissions: { cleaning: "request" },
      login_state: "pending_setup",
      login_metadata: { source: "pin-login-smoke", suffix }
    })
  });
  const inserted = await readJson(insertResponse);
  if (!insertResponse.ok) throw new Error(inserted?.message || inserted?.error || `app_users_insert_${insertResponse.status}`);
  appUserId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
  if (!appUserId) throw new Error("pin_smoke_app_user_id_missing");

  const validated = await apiRequest({
    publicUrl,
    path: "/api/session/initial-password",
    body: { action: "validate", identifier: workerNo }
  });
  if (validated.auth !== "pin" || validated.needsSetup !== true) throw new Error("pin_smoke_validate_unexpected");

  const completed = await apiRequest({
    publicUrl,
    path: "/api/session/initial-password",
    body: { action: "complete", identifier: workerNo, pin, remember: false }
  });
  if (!completed.pinSessionToken) throw new Error("pin_smoke_complete_token_missing");

  const rows = await serviceRows({
    root: supabaseUrl,
    serviceRoleKey,
    table: "app_users",
    select: "id,worker_no,pin_hash,pin_updated_at,login_state",
    query: `&id=eq.${encodeURIComponent(appUserId)}&limit=1`
  });
  const row = rows[0] || {};
  if (row.worker_no !== workerNo) throw new Error("pin_smoke_worker_no_mismatch");
  if (!String(row.pin_hash || "").startsWith("scrypt$")) throw new Error("pin_smoke_hash_missing");
  if (String(row.pin_hash || "").includes(pin)) throw new Error("pin_smoke_hash_contains_plain_pin");
  if (row.login_state !== "active") throw new Error("pin_smoke_login_state_not_active");
  if (!row.pin_updated_at) throw new Error("pin_smoke_pin_updated_at_missing");

  const loggedIn = await apiRequest({
    publicUrl,
    path: "/api/session/initial-password",
    body: { action: "login", identifier: workerNo, pin, remember: false }
  });
  if (!loggedIn.pinSessionToken) throw new Error("pin_smoke_login_token_missing");

  const session = await apiGet({
    publicUrl,
    path: "/api/session/me",
    token: loggedIn.pinSessionToken
  });
  if (session?.user?.id !== appUserId || session?.user?.workerNo !== workerNo) throw new Error("pin_smoke_session_mismatch");

  await apiRequest({
    publicUrl,
    path: "/api/users",
    token: adminAccessToken,
    body: {
      user: {
        id: appUserId,
        name: "Smoke PIN Worker",
        role: "worker",
        workerNo,
        dept: "Smoke",
        depts: ["Smoke"],
        active: true,
        loginResetRequested: true
      }
    }
  });

  const resetRows = await serviceRows({
    root: supabaseUrl,
    serviceRoleKey,
    table: "app_users",
    select: "id,worker_no,pin_hash,pin_updated_at,login_state",
    query: `&id=eq.${encodeURIComponent(appUserId)}&limit=1`
  });
  const resetRow = resetRows[0] || {};
  if (resetRow.pin_hash !== null) throw new Error("pin_smoke_reset_hash_not_cleared");
  if (resetRow.pin_updated_at !== null) throw new Error("pin_smoke_reset_updated_at_not_cleared");
  if (resetRow.login_state !== "reset_required") throw new Error("pin_smoke_reset_login_state_unexpected");

  const resetValidate = await apiRequest({
    publicUrl,
    path: "/api/session/initial-password",
    body: { action: "validate", identifier: workerNo }
  });
  if (resetValidate.auth !== "pin" || resetValidate.needsSetup !== true) throw new Error("pin_smoke_reset_validate_unexpected");

  console.log(JSON.stringify({
    ok: true,
    appUrl: publicUrl,
    user: { id: appUserId, workerNo, pinHash: "scrypt", loginState: row.login_state, resetState: resetRow.login_state }
  }, null, 2));
} finally {
  if (appUserId) {
    await serviceDelete({
      root: supabaseUrl,
      serviceRoleKey,
      table: "app_users",
      query: `id=eq.${encodeURIComponent(appUserId)}`
    }).catch(() => {});
  }
}
