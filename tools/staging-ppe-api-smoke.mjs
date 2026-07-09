#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";

const ENV_FILE = ".env.staging.local";
const CREDENTIALS_FILE = ".staging-admin-credentials.local";
const DEFAULT_APP_URL = "https://facility-maintenance-system.vercel.app";

const now = Date.now();
const suffix = `${now}-${Math.random().toString(36).slice(2, 8)}`;
const itemId = `smoke-ppe-item-${suffix}`;
const normId = `smoke-ppe-norm-${suffix}`;
const movementId = `smoke-ppe-movement-${suffix}`;
const requestId = `smoke-ppe-request-${suffix}`;
const orderId = `smoke-ppe-order-${suffix}`;

const RESOURCES = Object.freeze([
  {
    resource: "items",
    singular: "item",
    plural: "items",
    table: "ppe_items",
    id: itemId,
    record: { id: itemId, name: `Smoke PPE Item ${suffix}`, category: "smoke", sizes: ["M"], stockBySize: { M: 3 }, active: true, createdAt: now }
  },
  {
    resource: "norms",
    singular: "norm",
    plural: "norms",
    table: "ppe_norms",
    id: normId,
    record: { id: normId, dept: "staging", itemId, active: true, policy: "free", periodMonths: 12, createdAt: now }
  },
  {
    resource: "movements",
    singular: "movement",
    plural: "movements",
    table: "ppe_movements",
    id: movementId,
    record: { id: movementId, workerName: "Smoke Worker", itemId, itemName: "Smoke PPE Item", size: "M", qty: 1, type: "issue", at: now }
  },
  {
    resource: "requests",
    singular: "request",
    plural: "requests",
    table: "ppe_requests",
    id: requestId,
    record: { id: requestId, workerName: "Smoke Worker", status: "pending", lines: [{ itemId, itemName: "Smoke PPE Item", size: "M", qty: 1 }], at: now }
  },
  {
    resource: "orders",
    singular: "order",
    plural: "orders",
    table: "ppe_orders",
    id: orderId,
    record: { id: orderId, supplier: "Smoke Supplier", status: "draft", lines: [{ itemId, itemName: "Smoke PPE Item", size: "M", qty: 2 }], createdAt: now }
  }
]);

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

async function rows({ root, serviceRoleKey, table, id }) {
  const response = await fetch(`${root}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=id,source_kv_key`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `${table}_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function upsert({ publicUrl, accessToken, config }) {
  const response = await fetch(`${publicUrl}/api/ppe`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ resource: config.resource, [config.singular]: config.record })
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `ppe_${config.resource}_upsert_${response.status}`);
}

async function list({ publicUrl, accessToken, config }) {
  const response = await fetch(`${publicUrl}/api/ppe?resource=${encodeURIComponent(config.resource)}`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `ppe_${config.resource}_list_${response.status}`);
  return Array.isArray(data?.[config.plural]) ? data[config.plural] : [];
}

async function remove({ publicUrl, accessToken, config }) {
  const response = await fetch(`${publicUrl}/api/ppe?resource=${encodeURIComponent(config.resource)}&id=${encodeURIComponent(config.id)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `ppe_${config.resource}_delete_${response.status}`);
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

const results = {};

try {
  for (const config of RESOURCES) {
    await upsert({ publicUrl, accessToken, config });
    const afterUpsert = await rows({ root: supabaseUrl, serviceRoleKey, table: config.table, id: config.id });
    if (afterUpsert.length !== 1) throw new Error(`ppe_${config.resource}_upsert_row_count:${afterUpsert.length}`);
    const listed = await list({ publicUrl, accessToken, config });
    if (!listed.some((record) => record.id === config.id)) throw new Error(`ppe_${config.resource}_list_missing_smoke_record`);
    results[config.resource] = { id: config.id, upserted: true, listed: true };
  }

  for (const config of [...RESOURCES].reverse()) {
    await remove({ publicUrl, accessToken, config });
    const afterDelete = await rows({ root: supabaseUrl, serviceRoleKey, table: config.table, id: config.id });
    if (afterDelete.length !== 0) throw new Error(`ppe_${config.resource}_delete_row_count:${afterDelete.length}`);
    results[config.resource].deleted = true;
  }

  console.log(JSON.stringify({
    ok: true,
    appUrl: publicUrl,
    ppe: results
  }, null, 2));
} catch (error) {
  for (const config of [...RESOURCES].reverse()) {
    try {
      await fetch(`${publicUrl}/api/ppe?resource=${encodeURIComponent(config.resource)}&id=${encodeURIComponent(config.id)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${accessToken}` }
      });
    } catch {}
  }
  throw error;
}
