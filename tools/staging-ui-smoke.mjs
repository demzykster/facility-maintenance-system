import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium, devices } from "@playwright/test";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";

const ENV_FILE = ".env.staging.local";
const CREDENTIALS_FILE = ".staging-admin-credentials.local";
const DEFAULT_APP_URL = "https://facility-maintenance-system.vercel.app/";
const DESKTOP_MODULES = [
  "לוח בקרה",
  "קריאות",
  "מטלות",
  "ביגוד עובדים",
  "כלי שינוע",
  "אנליטיקה",
  "בקרת ניקיון",
  "צוות ומשתמשים",
  "ספקים / קבלנים",
  "יומן פעילות",
  "הגדרות",
  "התראות"
];

function loadEnvFile(file) {
  if (!existsSync(file)) return false;
  applyEnvValues(process.env, parseEnvFile(readFileSync(file, "utf8")));
  return true;
}

function appUrl() {
  return String(process.env.CMMS_UI_SMOKE_URL || process.env.CMMS_STAGING_APP_URL || process.env.STAGING_APP_URL || DEFAULT_APP_URL);
}

function expectedCommitFromArgs() {
  const args = new Set(process.argv.slice(2));
  const configured = String(process.env.CMMS_STAGING_EXPECT_COMMIT || "").trim();
  if (configured) return configured.slice(0, 7);
  if (!args.has("--expect-current-commit")) return "";
  return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" }).trim();
}

function adminCredentials() {
  const email = String(process.env.STAGING_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim();
  const password = String(process.env.STAGING_ADMIN_PASSWORD || process.env.ADMIN_NEW_PASSWORD || "").trim();
  if (!email || !password) throw new Error("missing_admin_credentials");
  return { email, password };
}

function relevantResponse(response) {
  const url = response.url();
  if (response.status() < 400) return false;
  if (/favicon\.ico$/.test(url)) return false;
  if (/\/api\/bootstrap\/admin/.test(url)) return false;
  return true;
}

function relevantConsoleMessage(message) {
  const text = message.text();
  return message.type() === "error" || /save failed|failed|exception|error/i.test(text);
}

async function assertNoSaveFailureToast(page, label) {
  await page.waitForTimeout(1200);
  const saveAlert = page.getByText("השמירה לא הושלמה", { exact: false });
  if (await saveAlert.count()) throw new Error(`${label}_save_failure_toast`);
  if (await page.locator('[role="alert"]').count()) throw new Error(`${label}_alert`);
}

async function waitForAnyVisible(page, selectors, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) return selector;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`app_shell_not_visible:${selectors.join(",")}`);
}

async function login(page, { email, password }) {
  await page.goto(appUrl(), { waitUntil: "networkidle", timeout: 30000 });
  await page.locator('input[type="email"], input[placeholder*="example"], input').first().fill(email);
  await page.locator("button.btn-primary").click();
  await page.locator('input[type="password"]').fill(password);
  await page.locator("button.btn-primary").click();
  await waitForAnyVisible(page, [".side-nav", ".tb-actions", ".bottom-nav"]);
}

async function desktopSmoke(browser, credentials, expectedCommit) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleMessages = [];
  const failedResponses = [];
  const configWrites = [];
  page.on("console", (msg) => { if (relevantConsoleMessage(msg)) consoleMessages.push(`${msg.type()}: ${msg.text()}`); });
  page.on("response", (response) => {
    if (response.request().method() === "PUT" && response.url().includes("/api/kv/config%3Av1")) configWrites.push(response.url());
    if (relevantResponse(response)) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await login(page, credentials);
  const version = await page.locator(".side-version").innerText().catch(() => "");
  if (expectedCommit && !version.includes(expectedCommit)) throw new Error(`desktop_version_mismatch:${version}`);
  if (await page.locator(".side-user-btn").count() < 1) throw new Error("desktop_profile_entry_missing");
  if (await page.getByRole("button", { name: /יציאה/ }).count() < 1) throw new Error("desktop_logout_missing");
  await page.getByRole("button", { name: /התאמת לוח/ }).click();
  await page.locator(".wtoggle").first().click();
  await assertNoSaveFailureToast(page, "desktop_dashboard_widget_toggle");
  if (configWrites.length) throw new Error("desktop_dashboard_widget_toggle_wrote_global_config");

  const modules = [];
  for (const label of DESKTOP_MODULES) {
    const button = page.locator(`button:has-text("${label}")`).first();
    if (await button.count() < 1) throw new Error(`desktop_module_missing:${label}`);
    await button.click();
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (Math.abs(overflow) > 2) throw new Error(`desktop_overflow:${label}:${overflow}`);
    if (label === "התראות" && await page.getByRole("dialog").count()) {
      await page.keyboard.press("Escape").catch(() => {});
    }
    modules.push(label);
  }

  if (consoleMessages.length) throw new Error(`desktop_console:${consoleMessages.slice(0, 3).join(" | ")}`);
  if (failedResponses.length) throw new Error(`desktop_responses:${failedResponses.slice(0, 3).join(" | ")}`);
  await page.close();
  return { version, modules };
}

async function mobileSmoke(browser, credentials) {
  const page = await browser.newPage({ ...devices["iPhone 14"], locale: "he-IL" });
  const consoleMessages = [];
  const failedResponses = [];
  page.on("console", (msg) => { if (relevantConsoleMessage(msg)) consoleMessages.push(`${msg.type()}: ${msg.text()}`); });
  page.on("response", (response) => { if (relevantResponse(response)) failedResponses.push(`${response.status()} ${response.url()}`); });

  await login(page, credentials);
  const topLogout = await page.locator(".tb-logout").count();
  const profileIcon = await page.locator('.tb-actions button[aria-label="הפרופיל שלי"]').count();
  const issueIcon = await page.locator('.tb-actions button[aria-label="דיווח על בעיה במערכת"]').count();
  const legacyTopSelect = await page.locator("select.mob-tab").count();
  const bottomItems = await page.locator(".bottom-nav button").evaluateAll((buttons) => buttons.map((button) => button.innerText.trim()).filter(Boolean));
  const bottomNav = await page.locator(".bottom-nav").evaluate((node) => ({
    className: node.className,
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth
  }));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (!topLogout) throw new Error("mobile_logout_missing");
  if (!profileIcon) throw new Error("mobile_profile_missing");
  if (!issueIcon) throw new Error("mobile_issue_report_missing");
  if (legacyTopSelect) throw new Error("mobile_legacy_module_select_present");
  if (bottomItems.length < 4) throw new Error("mobile_bottom_nav_too_short");
  if (bottomItems.length > 4 && (!String(bottomNav.className).includes("nav-scroll") || bottomNav.scrollWidth <= bottomNav.clientWidth)) throw new Error("mobile_bottom_nav_not_scrollable");
  if (Math.abs(overflow) > 2) throw new Error(`mobile_overflow:${overflow}`);

  await page.locator('.tb-actions button[aria-label="הפרופיל שלי"]').click();
  await page.getByRole("dialog").waitFor({ timeout: 10000 });
  const shell = await page.locator(".profile-shell").boundingBox();
  const modal = await page.locator(".profile-modal").boundingBox();
  if (!shell || !modal || Math.abs(shell.width - modal.width) > 2) throw new Error("mobile_profile_modal_shell_mismatch");
  if (await page.getByText("אפשר להשאיר ריק", { exact: false }).count()) throw new Error("mobile_profile_redundant_helper_present");
  await page.locator(".profile-modal button[aria-label='סגירה']").click();

  await page.locator('.tb-actions button[aria-label="דיווח על בעיה במערכת"]').click();
  await page.getByRole("dialog").waitFor({ timeout: 10000 });
  const issueShell = await page.locator(".issue-report-shell").boundingBox();
  const issueModal = await page.locator(".issue-modal").boundingBox();
  if (!issueShell || !issueModal || Math.abs(issueShell.width - issueModal.width) > 2) throw new Error("mobile_issue_modal_shell_mismatch");

  if (consoleMessages.length) throw new Error(`mobile_console:${consoleMessages.slice(0, 3).join(" | ")}`);
  if (failedResponses.length) throw new Error(`mobile_responses:${failedResponses.slice(0, 3).join(" | ")}`);
  await page.close();
  return { bottomItems };
}

loadEnvFile(ENV_FILE);
loadEnvFile(CREDENTIALS_FILE);

const expectedCommit = expectedCommitFromArgs();
const credentials = adminCredentials();
const browser = await chromium.launch({ headless: true });

try {
  const desktop = await desktopSmoke(browser, credentials, expectedCommit);
  const mobile = await mobileSmoke(browser, credentials);
  console.log(JSON.stringify({
    ok: true,
    url: appUrl(),
    expectedCommit: expectedCommit || "not_requested",
    desktop,
    mobile
  }, null, 2));
} catch (error) {
  console.error(`[staging-ui-smoke] failed ${error?.message || error}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
