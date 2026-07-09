#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";
import { isExpectedBrowserSmokeResponse, isRelevantBrowserSmokeConsoleMessage } from "../src/stagingBrowserSignalModel.js";
import { normalizeSupabaseUrl } from "../src/supabaseStagingSchemaCheckModel.js";

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

async function fleetSupabaseCount({ root, serviceRoleKey }) {
  const response = await fetch(`${root}/rest/v1/cmms_kv_records?scope=eq.shared&record_key=like.fleet%3A%25&select=record_key`, {
    method: "HEAD",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      prefer: "count=exact"
    }
  });
  if (!response.ok) throw new Error(`fleet_table_count_failed:${response.status}`);
  return Number(response.headers.get("content-range")?.split("/")?.pop() || 0);
}

async function fleetApiCount({ publicUrl, accessToken }) {
  const response = await fetch(`${publicUrl}/api/kv?prefixes=fleet%3A&shared=1&includeValues=1`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.error || `fleet_api_${response.status}`);
  const fleetRecords = data?.collections?.["fleet:"];
  if (!Array.isArray(fleetRecords)) throw new Error("fleet_api_collection_missing");
  return fleetRecords.length;
}

async function login(page, { publicUrl, email, password }) {
  await page.goto(publicUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator('input[type="email"], input[placeholder*="example"], input').first().fill(email);
  await page.locator("button.btn-primary").click();
  await page.locator('input[type="password"]').fill(password);
  await page.locator("button.btn-primary").click();
  await page.locator(".side-nav, .tb-actions, .bottom-nav").first().waitFor({ timeout: 30000 });
}

async function fleetUiCount({ publicUrl, email, password, expectedCount }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "he-IL" });
  const failedResponses = [];
  const consoleErrors = [];
  page.on("response", (response) => {
    if (!isExpectedBrowserSmokeResponse({ url: response.url(), status: response.status() })) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("console", (message) => {
    if (isRelevantBrowserSmokeConsoleMessage({ type: message.type(), text: message.text() })) consoleErrors.push(message.text());
  });

  try {
    await login(page, { publicUrl, email, password });
    await page.getByRole("button", { name: "כלי שינוע", exact: true }).click();
    await page.waitForFunction(() => document.body.innerText.includes("פארק כלי שינוע"), null, { timeout: 30000 });
    if (expectedCount > 0) {
      await page.waitForFunction((count) => document.body.innerText.includes(`פארק כלי שינוע (${count})`), expectedCount, { timeout: 30000 });
    } else {
      await page.waitForFunction(() => /הפארק ריק|0\s*כלים/.test(document.body.innerText), null, { timeout: 30000 });
    }
    await page.waitForTimeout(500);
    const bodyText = await page.locator("body").innerText();
    const headingMatch = bodyText.match(/פארק כלי שינוע\s*\((\d+)\)/);
    const toolsMatch = bodyText.match(/(\d+)\s*כלים/);
    const emptyMatch = /הפארק ריק|0\s*כלים/.test(bodyText);
    const count = headingMatch ? Number(headingMatch[1]) : (toolsMatch ? Number(toolsMatch[1]) : (emptyMatch ? 0 : NaN));
    if (!Number.isFinite(count)) throw new Error("fleet_ui_count_missing");
    if (failedResponses.length) throw new Error(`fleet_ui_kv_response_failed:${failedResponses.slice(0, 3).join(" | ")}`);
    if (consoleErrors.length) throw new Error(`fleet_ui_console_error:${consoleErrors.slice(0, 3).join(" | ")}`);
    return count;
  } finally {
    await browser.close();
  }
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
const supabaseCount = await fleetSupabaseCount({ root: supabaseUrl, serviceRoleKey });
const apiCount = await fleetApiCount({ publicUrl, accessToken });
const uiCount = await fleetUiCount({
  publicUrl,
  email: adminEmail,
  password: adminPassword,
  expectedCount: apiCount
});

if (apiCount !== supabaseCount) throw new Error(`fleet_api_supabase_mismatch:api=${apiCount}:supabase=${supabaseCount}`);
if (uiCount !== apiCount) throw new Error(`fleet_ui_api_mismatch:ui=${uiCount}:api=${apiCount}`);

console.log(JSON.stringify({
  ok: true,
  appUrl: publicUrl,
  fleet: {
    supabase: supabaseCount,
    api: apiCount,
    ui: uiCount
  }
}, null, 2));
