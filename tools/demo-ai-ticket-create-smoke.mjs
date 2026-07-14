import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";
import { isExpectedBrowserSmokeResponse, isRelevantBrowserSmokeConsoleMessage } from "../src/stagingBrowserSignalModel.js";

const PORT = Number(process.env.CMMS_DEMO_AI_TICKET_SMOKE_PORT || 4174);
const HOST = "127.0.0.1";
const APP_URL = process.env.CMMS_DEMO_AI_TICKET_SMOKE_URL || `http://${HOST}:${PORT}/`;
const SHOULD_START_PREVIEW = !process.env.CMMS_DEMO_AI_TICKET_SMOKE_URL;
const LOGIN_ID = process.env.CMMS_DEMO_AI_TICKET_SMOKE_LOGIN || "owner@example.local";
const LOGIN_PASSWORD = process.env.CMMS_DEMO_AI_TICKET_SMOKE_PASSWORD || "demo1234";
const WATCHDOG_MS = Number(process.env.CMMS_DEMO_AI_TICKET_SMOKE_TIMEOUT_MS || 90000);
const SUBJECT = `Smoke facility ticket ${Date.now()}`;

const watchdog = setTimeout(() => {
  console.error(`[demo-ai-ticket-smoke] timed out after ${WATCHDOG_MS}ms`);
  process.exit(124);
}, WATCHDOG_MS);

function logStep(step) {
  console.log(`[demo-ai-ticket-smoke] ${step}`);
}

function startPreviewServer() {
  const child = spawn("npm", ["run", "preview", "--", "--port", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env }
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  return { child, output: () => output };
}

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`preview_server_not_ready:${url}`);
}

async function stopServer(child) {
  if (!child || child.exitCode != null || child.signalCode != null) return;
  child.kill("SIGTERM");
  const result = await Promise.race([
    once(child, "exit"),
    new Promise((resolve) => setTimeout(() => resolve(["timeout"]), 5000))
  ]);
  if (result?.[0] === "timeout" && child.exitCode == null && child.signalCode == null) {
    child.kill("SIGKILL");
    await Promise.race([
      once(child, "exit"),
      new Promise((resolve) => setTimeout(resolve, 2000))
    ]);
  }
}

function relevantConsoleMessage(message) {
  return isRelevantBrowserSmokeConsoleMessage({ type: message.type(), text: message.text() });
}

function relevantResponse(response) {
  return !isExpectedBrowserSmokeResponse({ url: response.url(), status: response.status() });
}

async function waitForVisibleShell(page) {
  await page.waitForFunction(() => {
    const visible = (selector) => [...document.querySelectorAll(selector)].some((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    return visible(".side-nav") || visible(".topbar") || visible(".bottom-nav");
  }, null, { timeout: 15000 });
}

async function login(page) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator('input:not([type="checkbox"])').first().fill(LOGIN_ID);
  await page.getByRole("button", { name: /המשך|Continue|Продолжить|متابعة|जारी/i }).click();
  await page.locator('input[type="password"]').fill(LOGIN_PASSWORD);
  await page.getByRole("button", { name: /כניסה|Login|Войти|دخول|लॉग/i }).click();
  await waitForVisibleShell(page);
}

async function smokeAiPanel(page) {
  logStep("ai-panel:open");
  await page.locator(".ai-fab").click();
  await page.locator(".ai-panel").waitFor({ state: "visible", timeout: 15000 });
  await page.getByText("עוזר AI", { exact: false }).first().waitFor({ timeout: 10000 });
  await page.locator(".ai-panel input").fill("בדיקת smoke ללא כתיבה");
  await page.locator(".ai-panel button[aria-label='סגירה']").click();
  await page.locator(".ai-panel").waitFor({ state: "detached", timeout: 10000 });
}

async function smokeOrdinaryTicketCreate(page) {
  logStep("ticket-create:open-form");
  await page.locator(".side-newbtn").click();
  const form = page.locator(".ovl-inner").first();
  await form.waitFor({ state: "visible", timeout: 10000 });
  await form.locator(".track-pick", { hasText: "מבנה" }).click();
  await form.locator("input").first().fill(SUBJECT);
  await form.locator(".cat-pick").first().click();
  await form.locator("textarea").first().fill("Local browser smoke creates a demo facility ticket only.");
  await page.getByRole("button", { name: /שליחת הקריאה/ }).click();
  await page.locator(".ovl-inner").waitFor({ state: "detached", timeout: 10000 });

  logStep("ticket-create:verify-list");
  await page.getByRole("button", { name: /^קריאות$/ }).first().click();
  await page.getByText(SUBJECT, { exact: false }).first().waitFor({ timeout: 10000 });
}

async function main() {
  logStep(SHOULD_START_PREVIEW ? "start-preview" : "use-existing-preview");
  const server = SHOULD_START_PREVIEW ? startPreviewServer() : null;
  try {
    await waitForServer(APP_URL);
    logStep("launch-browser");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL" });
      await context.addInitScript(() => {
        window.localStorage.setItem("facility-maintenance:config:v1", JSON.stringify({
          ai: { mode: "server", provider: "openai", model: "gpt-5.2" }
        }));
      });
      const page = await context.newPage();
      const consoleMessages = [];
      const failedResponses = [];
      page.on("console", (message) => {
        if (relevantConsoleMessage(message)) consoleMessages.push(`${message.type()}: ${message.text()}`);
      });
      page.on("response", (response) => {
        if (relevantResponse(response)) failedResponses.push(`${response.status()} ${response.url()}`);
      });

      logStep("login");
      await login(page);
      await smokeAiPanel(page);
      await smokeOrdinaryTicketCreate(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await page.close();
      await context.close();

      if (overflow > 2) throw new Error(`horizontal_overflow:${overflow}`);
      if (consoleMessages.length) throw new Error(`console:${consoleMessages.slice(0, 3).join(" | ")}`);
      if (failedResponses.length) throw new Error(`responses:${failedResponses.slice(0, 3).join(" | ")}`);
      console.log(JSON.stringify({ ok: true, url: APP_URL, subject: SUBJECT }, null, 2));
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("[demo-ai-ticket-smoke] failed", error?.message || error);
    const output = server?.output?.() || "";
    if (output) console.error(output.slice(-4000));
    process.exitCode = 1;
  } finally {
    if (server) await stopServer(server.child);
    clearTimeout(watchdog);
  }
}

main();
