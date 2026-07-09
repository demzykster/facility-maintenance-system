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

async function ticketRows({ root, serviceRoleKey, id }) {
  const response = await fetch(`${root}/rest/v1/tickets?id=eq.${encodeURIComponent(id)}&select=id,status,subject,source_kv_key`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `tickets_table_${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function fileRows({ root, serviceRoleKey, path }) {
  const response = await fetch(`${root}/rest/v1/file_metadata?path=eq.${encodeURIComponent(path)}&deleted_at=is.null&select=path,owner_type,owner_id,kind`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || `file_metadata_${response.status}`);
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

const id = `smoke-ticket-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const subject = `staging tickets api smoke ${id}`;
const ticket = {
  id,
  num: 0,
  track: "facility",
  subject,
  description: "Controlled normalized tickets API smoke. Safe to delete.",
  status: "new",
  priority: "low",
  category: "other",
  zone: "staging-smoke",
  createdBy: { name: "Staging Smoke", role: "admin" },
  createdAt: Date.now(),
  updatedAt: Date.now()
};
const filePath = `tickets/${id}/before.jpg`;

try {
  const upsertResponse = await fetch(`${publicUrl}/api/tickets`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ ticket })
  });
  const upsertData = await readJson(upsertResponse);
  if (!upsertResponse.ok || !upsertData?.ok) throw new Error(upsertData?.error || `tickets_upsert_${upsertResponse.status}`);

  const afterUpsert = await ticketRows({ root: supabaseUrl, serviceRoleKey, id });
  if (afterUpsert.length !== 1) throw new Error(`tickets_upsert_row_count:${afterUpsert.length}`);
  if (afterUpsert[0].subject !== subject) throw new Error("tickets_upsert_subject_mismatch");

  const uploadResponse = await fetch(`${publicUrl}/api/files?path=${encodeURIComponent(filePath)}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      contentType: "image/jpeg",
      data: Buffer.from("staging-ticket-photo").toString("base64"),
      metadata: {
        ownerType: "ticket",
        ownerId: id,
        kind: "ticket_before_photo"
      }
    })
  });
  const uploadData = await readJson(uploadResponse);
  if (!uploadResponse.ok || !uploadData?.ok) throw new Error(uploadData?.error || `file_upload_${uploadResponse.status}`);

  const afterUpload = await fileRows({ root: supabaseUrl, serviceRoleKey, path: filePath });
  if (afterUpload.length !== 1) throw new Error(`file_metadata_row_count:${afterUpload.length}`);

  const readResponse = await fetch(`${publicUrl}/api/tickets?id=${encodeURIComponent(id)}&includeFiles=1`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const readData = await readJson(readResponse);
  if (!readResponse.ok || !readData?.ok) throw new Error(readData?.error || `tickets_read_${readResponse.status}`);
  if (!readData?.ticket?.files?.some((file) => file.path === filePath && file.ownerId === id)) throw new Error("ticket_files_missing");

  const fileDeleteResponse = await fetch(`${publicUrl}/api/files?path=${encodeURIComponent(filePath)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const fileDeleteData = await readJson(fileDeleteResponse);
  if (!fileDeleteResponse.ok || !fileDeleteData?.ok) throw new Error(fileDeleteData?.error || `file_delete_${fileDeleteResponse.status}`);

  const deleteResponse = await fetch(`${publicUrl}/api/tickets?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const deleteData = await readJson(deleteResponse);
  if (!deleteResponse.ok || !deleteData?.ok) throw new Error(deleteData?.error || `tickets_delete_${deleteResponse.status}`);

  const afterDelete = await ticketRows({ root: supabaseUrl, serviceRoleKey, id });
  if (afterDelete.length !== 0) throw new Error(`tickets_delete_row_count:${afterDelete.length}`);

  console.log(JSON.stringify({
    ok: true,
    appUrl: publicUrl,
    ticket: {
      id,
      upserted: true,
      fileLinked: true,
      deleted: true
    }
  }, null, 2));
} catch (error) {
  try {
    await fetch(`${publicUrl}/api/files?path=${encodeURIComponent(filePath)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` }
    });
  } catch {}
  try {
    await fetch(`${publicUrl}/api/tickets?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` }
    });
  } catch {}
  throw error;
}
