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

async function authAdminRequest({ root, serviceRoleKey, path, options = {} }) {
  const response = await fetch(`${root}/auth/v1/admin${path}`, {
    ...options,
    headers: serviceHeaders(serviceRoleKey, options.headers || {})
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `auth_admin_${response.status}`);
  return data?.user || data;
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

async function apiRequest({ publicUrl, accessToken, path, options = {} }) {
  const response = await fetch(`${publicUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await readJson(response);
  if (!response.ok || data?.ok === false) throw new Error(data?.error || `api_${response.status}`);
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

const accessToken = await supabasePasswordToken({
  url: supabaseUrl,
  anonKey,
  email: adminEmail,
  password: adminPassword
});

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const initialEmail = `cmms-smoke-${suffix}@example.invalid`;
const updatedEmail = `cmms-smoke-updated-${suffix}@example.invalid`;
let authUserId = "";
let appUserId = "";

try {
  const authUser = await authAdminRequest({
    root: supabaseUrl,
    serviceRoleKey,
    path: "/users",
    options: {
      method: "POST",
      body: JSON.stringify({
        email: initialEmail,
        password: `Smoke-${suffix}-pass-12345`,
        email_confirm: true,
        user_metadata: { name: "Smoke User", cmms_smoke: true },
        app_metadata: { cmms_role: "user", cmms_smoke: true }
      })
    }
  });
  authUserId = authUser?.id || "";
  if (!authUserId) throw new Error("smoke_auth_user_id_missing");

  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/app_users`, {
    method: "POST",
    headers: serviceHeaders(serviceRoleKey, { prefer: "return=representation" }),
    body: JSON.stringify({
      auth_user_id: authUserId,
      role: "user",
      name: "Smoke User",
      email: initialEmail,
      active: true,
      permissions: { users: "view" },
      login_metadata: { source: "users-api-smoke", suffix }
    })
  });
  const profileData = await readJson(profileResponse);
  if (!profileResponse.ok) throw new Error(profileData?.message || profileData?.error || `app_users_insert_${profileResponse.status}`);
  appUserId = Array.isArray(profileData) ? profileData[0]?.id : profileData?.id;
  if (!appUserId) throw new Error("smoke_app_user_id_missing");

  const updatedUser = {
    id: appUserId,
    authUserId,
    name: "Smoke User Updated",
    role: "user",
    email: updatedEmail,
    phone: "050-000-0000",
    dept: "Smoke",
    depts: ["Smoke"],
    perms: { users: "view", analytics: "view" },
    active: true,
    smoke: true
  };
  await apiRequest({
    publicUrl,
    accessToken,
    path: "/api/users",
    options: { method: "POST", body: JSON.stringify({ user: updatedUser }) }
  });

  const listed = await apiRequest({ publicUrl, accessToken, path: "/api/users", options: { method: "GET" } });
  if (!Array.isArray(listed.users) || !listed.users.some((user) => user.id === appUserId && user.email === updatedEmail)) throw new Error("users_api_smoke_user_not_listed");

  const rows = await serviceRows({
    root: supabaseUrl,
    serviceRoleKey,
    table: "app_users",
    select: "id,auth_user_id,email,name,permissions,active",
    query: `&id=eq.${encodeURIComponent(appUserId)}&limit=1`
  });
  if (rows[0]?.email !== updatedEmail || rows[0]?.name !== "Smoke User Updated" || rows[0]?.permissions?.analytics !== "view") {
    throw new Error("users_api_smoke_profile_not_updated");
  }

  await apiRequest({
    publicUrl,
    accessToken,
    path: `/api/users?id=${encodeURIComponent(appUserId)}`,
    options: { method: "DELETE" }
  });

  const deletedRows = await serviceRows({
    root: supabaseUrl,
    serviceRoleKey,
    table: "app_users",
    select: "id,active",
    query: `&id=eq.${encodeURIComponent(appUserId)}&limit=1`
  });
  if (deletedRows[0]?.active !== false) throw new Error("users_api_smoke_profile_not_deactivated");

  console.log(JSON.stringify({
    ok: true,
    appUrl: publicUrl,
    user: { id: appUserId, authUserId, updated: true, listed: true, deactivated: true }
  }, null, 2));
} finally {
  if (appUserId) {
    await serviceDelete({
      root: supabaseUrl,
      serviceRoleKey,
      table: "cmms_kv_records",
      query: `scope=eq.shared&record_key=eq.${encodeURIComponent(`user:${appUserId}`)}`
    }).catch(() => {});
    await serviceDelete({
      root: supabaseUrl,
      serviceRoleKey,
      table: "app_users",
      query: `id=eq.${encodeURIComponent(appUserId)}`
    }).catch(() => {});
  }
  if (authUserId) {
    await authAdminRequest({
      root: supabaseUrl,
      serviceRoleKey,
      path: `/users/${encodeURIComponent(authUserId)}`,
      options: { method: "DELETE" }
    }).catch(() => {});
  }
}
