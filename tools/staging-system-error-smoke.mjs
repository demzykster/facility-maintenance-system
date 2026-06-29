#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";

const ENV_FILE = ".env.staging.local";
const CREDENTIALS_FILE = ".staging-admin-credentials.local";
const DEFAULT_APP_URL = "https://facility-maintenance-system.vercel.app";

const loadEnvFile = (file) => {
  if (!existsSync(file)) return;
  applyEnvValues(process.env, parseEnvFile(readFileSync(file, "utf8")));
};

const requireEnv = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
};

const readJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
};

const appUrl = () => String(process.env.CMMS_STAGING_APP_URL || process.env.STAGING_APP_URL || DEFAULT_APP_URL).replace(/\/+$/, "");

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

loadEnvFile(ENV_FILE);
loadEnvFile(CREDENTIALS_FILE);

const publicUrl = appUrl();
const supabaseUrl = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
const anonKey = requireEnv("SUPABASE_ANON_KEY");
const adminEmail = String(process.env.STAGING_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.STAGING_ADMIN_PASSWORD || process.env.ADMIN_NEW_PASSWORD || "").trim();

if (!adminEmail || !adminPassword) throw new Error("missing_admin_credentials");

const token = await supabasePasswordToken({ url: supabaseUrl, anonKey, email: adminEmail, password: adminPassword });
const marker = `Controlled system-error smoke ${new Date().toISOString()}`;

const writeResponse = await fetch(`${publicUrl}/api/client-errors`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({
    kind: "storage_save_failed",
    message: marker,
    operation: "set",
    key: "smoke:system-error",
    shared: true,
    path: "/settings",
    metadata: { error: "controlled_smoke" }
  })
});
const writeData = await readJson(writeResponse);
if (!writeResponse.ok) throw new Error(writeData?.error || `client_errors_${writeResponse.status}`);

const listResponse = await fetch(`${publicUrl}/api/system-errors?limit=25`, {
  headers: { authorization: `Bearer ${token}` }
});
const listData = await readJson(listResponse);
if (!listResponse.ok) throw new Error(listData?.error || `system_errors_${listResponse.status}`);

const found = (listData.errors || []).find((item) => item.summary === marker && item.kind === "storage_save_failed");
if (!found) throw new Error("controlled_system_error_not_found");

console.log(JSON.stringify({
  ok: true,
  appUrl: publicUrl,
  found: {
    id: found.id,
    at: found.at,
    actorRole: found.actorRole,
    kind: found.kind,
    operation: found.operation,
    key: found.key
  }
}, null, 2));
