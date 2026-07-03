import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { STAGING_SUPABASE_TABLES, normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";

const ENV_FILE = ".env.staging.local";
const CREDENTIALS_FILE = ".staging-admin-credentials.local";
const DEFAULT_APP_URL = "https://facility-maintenance-system.vercel.app";

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

function expectedCommitFromArgs() {
  const args = new Set(process.argv.slice(2));
  const configured = String(process.env.CMMS_STAGING_EXPECT_COMMIT || "").trim();
  if (configured) return configured.slice(0, 7);
  if (!args.has("--expect-current-commit")) return "";
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    throw new Error("expected_commit_unavailable");
  }
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

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`[staging-smoke] ok ${name}${detail ? ` ${detail}` : ""}`);
    return true;
  } catch (error) {
    console.error(`[staging-smoke] fail ${name}: ${error?.message || error}`);
    return false;
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

async function supabaseCount({ url, serviceRoleKey, table }) {
  const response = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}?select=*`, {
    method: "HEAD",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      prefer: "count=exact"
    }
  });
  if (!response.ok) throw new Error(`${table}:${response.status}`);
  return response.headers.get("content-range")?.split("/")?.pop() || "?";
}

async function assertDeployedCommit({ url, html, expectedCommit }) {
  if (!expectedCommit) return "";
  const normalized = String(expectedCommit || "").slice(0, 7);
  if (html.includes(normalized)) return normalized;

  const scriptPaths = [...html.matchAll(/<script[^>]+src=["']([^"']+\.js)["']/g)]
    .map((match) => match[1])
    .filter(Boolean);
  for (const path of scriptPaths) {
    const scriptUrl = path.startsWith("http") ? path : `${url}${path.startsWith("/") ? "" : "/"}${path}`;
    const response = await fetch(scriptUrl);
    if (!response.ok) continue;
    const text = await response.text();
    if (text.includes(normalized)) return normalized;
  }

  throw new Error(`deployed_commit_not_found:${normalized}`);
}

loadEnvFile(ENV_FILE);
loadEnvFile(CREDENTIALS_FILE);

const publicUrl = appUrl();
const expectedCommit = expectedCommitFromArgs();
const supabaseUrl = normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
const anonKey = requireEnv("SUPABASE_ANON_KEY");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const bucketName = requireEnv("CMMS_FILE_BUCKET");
const adminEmail = String(process.env.STAGING_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.STAGING_ADMIN_PASSWORD || process.env.ADMIN_NEW_PASSWORD || "").trim();

if (!adminEmail || !adminPassword) {
  console.error("[staging-smoke] fail admin credentials: missing STAGING_ADMIN_EMAIL/STAGING_ADMIN_PASSWORD or local admin credentials file");
  process.exit(1);
}

const results = [];
let appHtml = "";

results.push(await check("app shell", async () => {
  const response = await fetch(publicUrl);
  if (!response.ok) throw new Error(`http_${response.status}`);
  appHtml = await response.text();
  if (!appHtml.includes("root") && !appHtml.includes("CMMS")) throw new Error("unexpected_html");
  return publicUrl;
}));

results.push(await check("deployed commit", async () => {
  const commit = await assertDeployedCommit({ url: publicUrl, html: appHtml, expectedCommit });
  return commit ? `commit=${commit}` : "not_requested";
}));

results.push(await check("bootstrap closed", async () => {
  const response = await fetch(`${publicUrl}/api/bootstrap/admin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  const data = await readJson(response);
  if (response.status !== 503 || data?.error !== "bootstrap_disabled") {
    throw new Error(`expected_bootstrap_disabled_got_${response.status}:${data?.error || "unknown"}`);
  }
}));

let accessToken = "";
results.push(await check("admin auth", async () => {
  accessToken = await supabasePasswordToken({
    url: supabaseUrl,
    anonKey,
    email: adminEmail,
    password: adminPassword
  });
}));

results.push(await check("session profile", async () => {
  const response = await fetch(`${publicUrl}/api/session/me`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error || `session_${response.status}`);
  if (data?.user?.role !== "admin") throw new Error(`expected_admin_got_${data?.user?.role || "missing"}`);
  if (data?.user?.mustChangePassword) throw new Error("admin_must_change_password");
}));

results.push(await check("kv bridge read", async () => {
  const response = await fetch(`${publicUrl}/api/kv?prefix=ticket%3A&shared=1`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error || `kv_${response.status}`);
  if (!Array.isArray(data?.keys)) throw new Error("kv_keys_missing");
  return `tickets=${data.keys.length}`;
}));

results.push(await check("file route auth boundary", async () => {
  const response = await fetch(`${publicUrl}/api/files?path=tickets%2Fmissing-smoke.txt`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (response.status !== 404 || data?.error !== "file_metadata_not_found") {
    throw new Error(`expected_file_metadata_not_found_got_${response.status}:${data?.error || "unknown"}`);
  }
}));

results.push(await check("supabase tables", async () => {
  const counts = [];
  for (const table of STAGING_SUPABASE_TABLES) {
    counts.push(`${table}=${await supabaseCount({ url: supabaseUrl, serviceRoleKey, table })}`);
  }
  return counts.join(" ");
}));

results.push(await check("supabase file bucket", async () => {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(bucketName)}`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(`bucket_${response.status}`);
  if (data?.public !== false) throw new Error("bucket_must_be_private");
  return bucketName;
}));

if (results.every(Boolean)) {
  console.log("[staging-smoke] live smoke ok");
} else {
  console.error("[staging-smoke] live smoke failed");
  process.exit(1);
}
