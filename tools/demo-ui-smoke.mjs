import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";
import { isExpectedBrowserSmokeResponse, isRelevantBrowserSmokeConsoleMessage } from "../src/stagingBrowserSignalModel.js";

const PORT = Number(process.env.CMMS_DEMO_UI_SMOKE_PORT || 4173);
const HOST = "127.0.0.1";
const APP_URL = process.env.CMMS_DEMO_UI_SMOKE_URL || `http://${HOST}:${PORT}/`;
const SHOULD_START_PREVIEW = !process.env.CMMS_DEMO_UI_SMOKE_URL;
const LOGIN_ID = process.env.CMMS_DEMO_UI_SMOKE_LOGIN || "owner@example.local";
const LOGIN_PASSWORD = process.env.CMMS_DEMO_UI_SMOKE_PASSWORD || "demo1234";
const WATCHDOG_MS = Number(process.env.CMMS_DEMO_UI_SMOKE_TIMEOUT_MS || 90000);

const watchdog = setTimeout(() => {
  console.error(`[demo-ui-smoke] timed out after ${WATCHDOG_MS}ms`);
  process.exit(124);
}, WATCHDOG_MS);

function logStep(step) {
  console.log(`[demo-ui-smoke] ${step}`);
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
    } catch (error) {
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

async function scanApp(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const smallControls = [...document.querySelectorAll('button,a,input,select,textarea,[role="button"],label.chk-line')]
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label = element.getAttribute("aria-label") || element.textContent?.trim() || element.getAttribute("placeholder") || element.tagName;
        return {
          tag: element.tagName,
          className: typeof element.className === "string" ? element.className : "",
          label: String(label || "").replace(/\s+/g, " ").slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })
      .filter((control) => control.width < 44 || control.height < 44);
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sideNavVisible: [...document.querySelectorAll(".side-nav")].some(visible),
      topbarVisible: [...document.querySelectorAll(".topbar")].some(visible),
      bottomNavVisible: [...document.querySelectorAll(".bottom-nav")].some(visible),
      smallControls: smallControls.slice(0, 20),
      loadDemoVisible: [...document.querySelectorAll("button")].some((button) => /טען נתוני דמו/.test(button.textContent || "")),
      text: document.body.innerText.slice(0, 240)
    };
  });
}

async function runViewport(browser, name, viewport) {
  logStep(`${name}:open`);
  const page = await browser.newPage({ viewport, locale: "he-IL" });
  const consoleMessages = [];
  const failedResponses = [];
  page.on("console", (message) => {
    if (relevantConsoleMessage(message)) consoleMessages.push(`${message.type()}: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (relevantResponse(response)) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  logStep(`${name}:login`);
  await login(page);
  logStep(`${name}:scan`);
  await page.waitForTimeout(700);
  const scan = await scanApp(page);
  await page.close();

  if (scan.overflow > 2) throw new Error(`${name}_horizontal_overflow:${scan.overflow}`);
  if (!scan.sideNavVisible && !scan.topbarVisible && !scan.bottomNavVisible) throw new Error(`${name}_shell_missing`);
  if (scan.smallControls.length) throw new Error(`${name}_small_controls:${JSON.stringify(scan.smallControls.slice(0, 3))}`);
  if (!scan.loadDemoVisible) throw new Error(`${name}_demo_action_missing`);
  if (consoleMessages.length) throw new Error(`${name}_console:${consoleMessages.slice(0, 3).join(" | ")}`);
  if (failedResponses.length) throw new Error(`${name}_responses:${failedResponses.slice(0, 3).join(" | ")}`);
  return { name, scan };
}

async function main() {
  logStep(SHOULD_START_PREVIEW ? "start-preview" : "use-existing-preview");
  const server = SHOULD_START_PREVIEW ? startPreviewServer() : null;
  try {
    await waitForServer(APP_URL);
    logStep("launch-browser");
    const browser = await chromium.launch({ headless: true });
    try {
      const desktop = await runViewport(browser, "desktop", { width: 1440, height: 900 });
      const mobile = await runViewport(browser, "mobile", { width: 390, height: 844 });
      console.log(JSON.stringify({ ok: true, url: APP_URL, desktop, mobile }, null, 2));
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("[demo-ui-smoke] failed", error?.message || error);
    const output = server?.output?.() || "";
    if (output) console.error(output.slice(-4000));
    process.exitCode = 1;
  } finally {
    if (server) await stopServer(server.child);
    clearTimeout(watchdog);
  }
}

main();
