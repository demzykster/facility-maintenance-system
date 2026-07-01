#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";

const ENV_FILE = ".env.staging.local";
const CREDENTIALS_FILE = ".staging-admin-credentials.local";
const DEFAULT_APP_URL = "https://facility-maintenance-system.vercel.app";
const CONFIG_KEY = "config:v1";

function loadEnvFile(file) {
  if (!existsSync(file)) return false;
  applyEnvValues(process.env, parseEnvFile(readFileSync(file, "utf8")));
  return true;
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
    headers: {
      apikey: anonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error_description || data?.msg || data?.message || `auth_${response.status}`);
  if (!data?.access_token) throw new Error("auth_access_token_missing");
  return data.access_token;
}

async function kvGet({ publicUrl, token, key }) {
  const response = await fetch(`${publicUrl}/api/kv/${encodeURIComponent(key)}?shared=1`, {
    headers: { authorization: `Bearer ${token}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error || `kv_get_${response.status}`);
  return data?.value ?? null;
}

async function kvSet({ publicUrl, token, key, value }) {
  const response = await fetch(`${publicUrl}/api/kv/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ value, shared: true })
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error || `kv_set_${response.status}`);
  return data;
}

async function kvDelete({ publicUrl, token, key }) {
  const response = await fetch(`${publicUrl}/api/kv/${encodeURIComponent(key)}?shared=1`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error || `kv_delete_${response.status}`);
  return data;
}

function parseConfig(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("config_json_invalid");
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function firstKey(obj, fallback) {
  const keys = Object.keys(obj || {}).filter(Boolean);
  return keys[0] || fallback;
}

loadEnvFile(ENV_FILE);
loadEnvFile(CREDENTIALS_FILE);

const publicUrl = appUrl();
const supabaseUrl = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
const anonKey = requireEnv("SUPABASE_ANON_KEY");
const adminEmail = String(process.env.STAGING_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.STAGING_ADMIN_PASSWORD || process.env.ADMIN_NEW_PASSWORD || "").trim();

if (!adminEmail || !adminPassword) throw new Error("missing_admin_credentials");

const token = await supabasePasswordToken({
  url: supabaseUrl,
  anonKey,
  email: adminEmail,
  password: adminPassword
});

const originalRaw = await kvGet({ publicUrl, token, key: CONFIG_KEY });
const originalConfig = parseConfig(originalRaw);
const originalSerialized = typeof originalRaw === "string" ? originalRaw : JSON.stringify(originalConfig);
const marker = `settings-smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const categorySlaKey = firstKey(originalConfig.catSla, "other");
const vehicleTypeSlaKey = firstKey(originalConfig.typeSla, "staging-smoke-model");
const probeConfig = {
  ...originalConfig,
  catSla: {
    ...cloneJson(originalConfig.catSla),
    [categorySlaKey]: {
      ...cloneJson(originalConfig.catSla?.[categorySlaKey]),
      high: 11,
      medium: 22,
      low: 33
    }
  },
  typeSla: {
    ...cloneJson(originalConfig.typeSla),
    [vehicleTypeSlaKey]: {
      ...cloneJson(originalConfig.typeSla?.[vehicleTypeSlaKey]),
      high: 12,
      medium: 24,
      low: 48
    }
  },
  __settingsPersistenceSmoke: {
    marker,
    at: new Date().toISOString()
  }
};

let restoreNeeded = false;
try {
  await kvSet({ publicUrl, token, key: CONFIG_KEY, value: JSON.stringify(probeConfig) });
  restoreNeeded = true;

  const savedRaw = await kvGet({ publicUrl, token, key: CONFIG_KEY });
  const savedConfig = parseConfig(savedRaw);
  if (savedConfig?.__settingsPersistenceSmoke?.marker !== marker) {
    throw new Error("settings_marker_not_persisted");
  }
  if (Number(savedConfig?.catSla?.[categorySlaKey]?.high) !== 11 || Number(savedConfig?.catSla?.[categorySlaKey]?.low) !== 33) {
    throw new Error("category_sla_not_persisted");
  }
  if (Number(savedConfig?.typeSla?.[vehicleTypeSlaKey]?.high) !== 12 || Number(savedConfig?.typeSla?.[vehicleTypeSlaKey]?.low) !== 48) {
    throw new Error("vehicle_type_sla_not_persisted");
  }
} finally {
  if (restoreNeeded) {
    await kvSet({ publicUrl, token, key: CONFIG_KEY, value: originalSerialized });
  }
}

const restoredRaw = await kvGet({ publicUrl, token, key: CONFIG_KEY });
const restoredConfig = parseConfig(restoredRaw);
if (restoredConfig?.__settingsPersistenceSmoke) {
  throw new Error("settings_marker_not_restored");
}

const tempPrefixes = [
  ["mtask", { id: "", title: "Controlled task persistence smoke", status: "open", createdAt: Date.now() }],
  ["ppeitem", { id: "", name: "Controlled PPE persistence smoke", category: "smoke", active: true }],
  ["czone", { id: "", name: "Controlled cleaning-zone persistence smoke", area: "smoke", active: true }]
];
const recordResults = [];

for (const [prefix, template] of tempPrefixes) {
  const id = `smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const key = `${prefix}:${id}`;
  const value = JSON.stringify({ ...template, id });
  try {
    await kvSet({ publicUrl, token, key, value });
    const savedRaw = await kvGet({ publicUrl, token, key });
    const saved = savedRaw ? JSON.parse(savedRaw) : null;
    if (saved?.id !== id) throw new Error(`${prefix}_marker_not_persisted`);
    await kvDelete({ publicUrl, token, key });
    const afterDelete = await kvGet({ publicUrl, token, key });
    if (afterDelete !== null) throw new Error(`${prefix}_marker_not_deleted`);
    recordResults.push({ prefix, ok: true });
  } catch (error) {
    await kvDelete({ publicUrl, token, key }).catch(() => {});
    throw error;
  }
}

console.log(JSON.stringify({
  ok: true,
  appUrl: publicUrl,
  key: CONFIG_KEY,
  marker,
  sla: {
    category: categorySlaKey,
    vehicleType: vehicleTypeSlaKey,
    persisted: true
  },
  restored: true,
  records: recordResults
}, null, 2));
