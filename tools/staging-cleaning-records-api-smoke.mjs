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

async function serviceRows({ root, serviceRoleKey, table, select = "*", query = "" }) {
  const response = await fetch(`${root}/rest/v1/${table}?select=${encodeURIComponent(select)}${query}`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `${table}_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function serviceDelete({ root, serviceRoleKey, table, id }) {
  await fetch(`${root}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      prefer: "return=minimal"
    }
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
const complaintId = `smoke-cleaning-complaint-${suffix}`;
const absenceId = `smoke-worker-absence-${suffix}`;
const today = new Date().toISOString().slice(0, 10);
const zoneRows = await serviceRows({ root: supabaseUrl, serviceRoleKey, table: "cleaning_zones", select: "id,name", query: "&limit=1" });
const zone = zoneRows[0] || {};
const complaint = {
  id: complaintId,
  zoneId: zone.id || null,
  zoneName: zone.name || "Smoke zone",
  kind: "dirty",
  text: "Smoke complaint",
  status: "pending",
  ownerRole: "cleaner",
  at: Date.now(),
  verified: false,
  smoke: true
};
const absence = {
  id: absenceId,
  userId: "smoke-worker",
  name: "Smoke Worker",
  from: today,
  to: today,
  reason: "smoke",
  at: Date.now(),
  smoke: true
};

try {
  await apiRequest({
    publicUrl,
    accessToken,
    path: "/api/cleaning/records",
    options: { method: "POST", body: JSON.stringify({ resource: "complaints", complaint }) }
  });
  await apiRequest({
    publicUrl,
    accessToken,
    path: "/api/cleaning/records",
    options: { method: "POST", body: JSON.stringify({ resource: "absences", absence }) }
  });

  const complaintRows = await serviceRows({
    root: supabaseUrl,
    serviceRoleKey,
    table: "cleaning_complaints",
    select: "id,legacy_payload",
    query: `&id=eq.${encodeURIComponent(complaintId)}&limit=1`
  });
  if (complaintRows[0]?.id !== complaintId || complaintRows[0]?.legacy_payload?.id !== complaintId) throw new Error("cleaning_complaint_row_missing_after_upsert");

  const absenceRows = await serviceRows({
    root: supabaseUrl,
    serviceRoleKey,
    table: "worker_absences",
    select: "id,legacy_payload",
    query: `&id=eq.${encodeURIComponent(absenceId)}&limit=1`
  });
  if (absenceRows[0]?.id !== absenceId || absenceRows[0]?.legacy_payload?.id !== absenceId) throw new Error("worker_absence_row_missing_after_upsert");

  const listedComplaints = await apiRequest({ publicUrl, accessToken, path: "/api/cleaning/records?resource=complaints&limit=2000", options: { method: "GET" } });
  if (!Array.isArray(listedComplaints.complaints) || !listedComplaints.complaints.some((item) => item.id === complaintId)) throw new Error("cleaning_complaint_not_listed_after_upsert");

  const listedAbsences = await apiRequest({ publicUrl, accessToken, path: "/api/cleaning/records?resource=absences&limit=2000", options: { method: "GET" } });
  if (!Array.isArray(listedAbsences.absences) || !listedAbsences.absences.some((item) => item.id === absenceId)) throw new Error("worker_absence_not_listed_after_upsert");

  await apiRequest({ publicUrl, accessToken, path: `/api/cleaning/records?resource=complaints&id=${encodeURIComponent(complaintId)}`, options: { method: "DELETE" } });
  await apiRequest({ publicUrl, accessToken, path: `/api/cleaning/records?resource=absences&id=${encodeURIComponent(absenceId)}`, options: { method: "DELETE" } });

  const afterComplaintDelete = await serviceRows({
    root: supabaseUrl,
    serviceRoleKey,
    table: "cleaning_complaints",
    select: "id",
    query: `&id=eq.${encodeURIComponent(complaintId)}&limit=1`
  });
  if (afterComplaintDelete.length) throw new Error("cleaning_complaint_row_not_deleted");

  const afterAbsenceDelete = await serviceRows({
    root: supabaseUrl,
    serviceRoleKey,
    table: "worker_absences",
    select: "id",
    query: `&id=eq.${encodeURIComponent(absenceId)}&limit=1`
  });
  if (afterAbsenceDelete.length) throw new Error("worker_absence_row_not_deleted");

  console.log(JSON.stringify({
    ok: true,
    appUrl: publicUrl,
    cleaningComplaint: { id: complaintId, upserted: true, listed: true, deleted: true },
    workerAbsence: { id: absenceId, upserted: true, listed: true, deleted: true }
  }, null, 2));
} catch (error) {
  await serviceDelete({ root: supabaseUrl, serviceRoleKey, table: "cleaning_complaints", id: complaintId }).catch(() => {});
  await serviceDelete({ root: supabaseUrl, serviceRoleKey, table: "worker_absences", id: absenceId }).catch(() => {});
  throw error;
}
