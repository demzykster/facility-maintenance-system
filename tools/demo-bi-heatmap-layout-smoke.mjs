import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";

const PORT = Number(process.env.CMMS_DEMO_BI_HEATMAP_PORT || 5174);
const HOST = "127.0.0.1";
const APP_URL = process.env.CMMS_DEMO_BI_HEATMAP_URL || `http://${HOST}:${PORT}/`;
const SHOULD_START_DEV = !process.env.CMMS_DEMO_BI_HEATMAP_URL;
const LOGIN_ID = process.env.CMMS_DEMO_BI_HEATMAP_LOGIN || "owner@example.local";
const LOGIN_PASSWORD = process.env.CMMS_DEMO_BI_HEATMAP_PASSWORD || "demo1234";
const WATCHDOG_MS = Number(process.env.CMMS_DEMO_BI_HEATMAP_TIMEOUT_MS || 90000);
const MAX_DOC_OVERFLOW = 2;
const MAX_MOBILE_ROW_HEIGHT = 78;

const heatmapRows = [
  {
    name: "אחזקה ותשתיות מרכזיות",
    count: "23 קריאות פתוחות",
    tags: ["ממתין 8", "ללא תנועה 5", "מעל שבוע 4"],
    values: [23, 2, 0, 8, 4, 5]
  },
  {
    name: "שינוע ומלגזות",
    count: "14 קריאות פתוחות",
    tags: ["השבתה 3", "SLA 2", "ללא תנועה 2"],
    values: [14, 2, 3, 1, 2, 2]
  },
  {
    name: "ניקיון אזורי ייצור ארוכים במיוחד",
    count: "9 קריאות פתוחות",
    tags: ["ממתין 4", "מעל שבוע 3"],
    values: [9, 1, 0, 4, 3, 1]
  }
];
const heatmapColumns = ["פתוחות", "SLA", "השבתה", "ממתין", "מעל שבוע", "ללא תנועה"];

const watchdog = setTimeout(() => {
  console.error(`[demo-bi-heatmap-layout-smoke] timed out after ${WATCHDOG_MS}ms`);
  process.exit(124);
}, WATCHDOG_MS);

function startDevServer() {
  const child = spawn("npm", ["run", "dev", "--", "--port", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env }
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  return { child, output: () => output };
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

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      // The Vite dev server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`dev_server_not_ready:${url}`);
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

function heatmapMarkup() {
  return `
    <div class="bi-heatmap-insight"><b>אחזקה ותשתיות</b><span>מוקד הסיכון: ממתין · 8</span></div>
    <div class="bi-heatmap" role="table" aria-label="מפת חום קריאות פתוחות">
      <div class="bi-heatmap-head" role="row">
        <span role="columnheader">תחום</span>
        ${heatmapColumns.map((label) => `<span role="columnheader">${label}</span>`).join("")}
      </div>
      ${heatmapRows.map((row) => `
        <div class="bi-heatmap-row" role="row">
          <button type="button" class="bi-heatmap-name" role="cell">
            <span class="bi-heatmap-name-main"><b>${row.name}</b><small>${row.count}</small></span>
            <span class="bi-heatmap-risk-tags">${row.tags.map((tag) => `<i>${tag}</i>`).join("")}</span>
            <span class="bi-heatmap-ai">AI</span>
          </button>
          ${row.values.map((value, index) => `
            <button type="button" class="bi-heatmap-cell${value ? " hot" : ""}" role="cell" style="--heat:${value / 23}">
              <b>${value}</b><small>${heatmapColumns[index]}</small>
            </button>
          `).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

function assertClose(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}:${actual.toFixed(2)}!=${expected.toFixed(2)}`);
  }
}

function horizontalOverlap(leftRect, rightRect) {
  return Math.max(0, Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left));
}

async function injectHeatmap(page) {
  await page.waitForSelector(".bi-heatmap-panel", { timeout: 10000 });
  const result = await page.evaluate((markup) => {
    const panel = document.querySelector(".bi-heatmap-panel");
    if (!panel) return { ok: false, reason: "panel_missing" };
    panel.querySelectorAll(".bi-heatmap-insight,.bi-heatmap,.note").forEach((element) => element.remove());
    panel.insertAdjacentHTML("beforeend", markup);
    return { ok: true };
  }, heatmapMarkup());
  if (!result.ok) throw new Error(`heatmap_injection_failed:${result.reason}`);
  await page.locator(".bi-heatmap-panel").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
}

async function measureDocumentOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function measureLayout(page) {
  return page.evaluate(() => {
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height
      };
    };
    const visible = (element) => {
      const box = element.getBoundingClientRect();
      return box.right > 0 && box.left < window.innerWidth && box.bottom > 0 && box.top < window.innerHeight;
    };
    const heatmap = document.querySelector(".bi-heatmap");
    const head = document.querySelector(".bi-heatmap-head");
    const firstHeader = document.querySelector(".bi-heatmap-head span:first-child");
    const firstRow = document.querySelector(".bi-heatmap-row");
    const firstName = document.querySelector(".bi-heatmap-name");
    const firstCell = document.querySelector(".bi-heatmap-cell");
    const secondRowName = document.querySelectorAll(".bi-heatmap-name")[1];
    const riskTags = document.querySelector(".bi-heatmap-risk-tags");
    const aiChip = document.querySelector(".bi-heatmap-ai");
    return {
      direction: document.dir || getComputedStyle(document.body).direction,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      heatmapClientWidth: heatmap.clientWidth,
      heatmapScrollWidth: heatmap.scrollWidth,
      heatmapOverflowX: getComputedStyle(heatmap).overflowX,
      gridTemplateColumns: getComputedStyle(head).gridTemplateColumns,
      firstHeader: rect(firstHeader),
      firstName: rect(firstName),
      firstCell: rect(firstCell),
      secondRowName: rect(secondRowName),
      riskTags: rect(riskTags),
      aiChip: rect(aiChip),
      headerVisible: visible(firstHeader),
      firstNameVisible: visible(firstName),
      rowHeight: rect(firstRow).height,
      nameScroll: {
        width: firstName.scrollWidth,
        clientWidth: firstName.clientWidth,
        height: firstName.scrollHeight,
        clientHeight: firstName.clientHeight
      }
    };
  });
}

async function runViewport(browser, name, viewport) {
  const page = await browser.newPage({ viewport, locale: "he-IL" });
  const consoleMessages = [];
  const pageErrors = [];
  const failedResponses = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleMessages.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await login(page);
  const baselineDocumentOverflowX = await measureDocumentOverflow(page);
  await injectHeatmap(page);
  const layout = await measureLayout(page);
  await page.screenshot({ path: `/tmp/cmms-bi-heatmap-layout-${name}.png`, fullPage: true });
  await page.close();

  if (layout.direction !== "rtl") throw new Error(`${name}:direction_not_rtl:${layout.direction}`);
  const allowedDocumentOverflow = Math.max(MAX_DOC_OVERFLOW, baselineDocumentOverflowX);
  if (layout.documentOverflowX > allowedDocumentOverflow) {
    throw new Error(`${name}:document_overflow_added:${JSON.stringify({ before: baselineDocumentOverflowX, after: layout.documentOverflowX })}`);
  }
  if (!layout.headerVisible) throw new Error(`${name}:domain_header_not_visible`);
  if (!layout.firstNameVisible) throw new Error(`${name}:first_column_not_visible`);
  assertClose(layout.firstHeader.left, layout.firstName.left, 1.5, `${name}:first_column_left_alignment`);
  assertClose(layout.firstHeader.right, layout.firstName.right, 1.5, `${name}:first_column_right_alignment`);
  if (layout.firstCell.right > layout.firstName.left) throw new Error(`${name}:first_metric_overlaps_domain_column`);
  if (viewport.width <= 760 && layout.rowHeight > MAX_MOBILE_ROW_HEIGHT) throw new Error(`${name}:mobile_row_too_tall:${layout.rowHeight}`);
  if (viewport.width <= 390 && horizontalOverlap(layout.riskTags, layout.aiChip) > 1) {
    throw new Error(`${name}:risk_tags_overlap_ai_chip:${JSON.stringify({ riskTags: layout.riskTags, aiChip: layout.aiChip })}`);
  }
  if (consoleMessages.length) throw new Error(`${name}:console:${consoleMessages.slice(0, 3).join(" | ")}`);
  if (pageErrors.length) throw new Error(`${name}:pageerror:${pageErrors.slice(0, 3).join(" | ")}`);
  if (failedResponses.length) throw new Error(`${name}:responses:${failedResponses.slice(0, 3).join(" | ")}`);

  return { name, viewport, baselineDocumentOverflowX, layout };
}

async function main() {
  const server = SHOULD_START_DEV ? startDevServer() : null;
  try {
    await waitForServer(APP_URL);
    const browser = await chromium.launch({ headless: true });
    try {
      const results = [];
      for (const [name, viewport] of Object.entries({
        desktop1440: { width: 1440, height: 900 },
        tablet760: { width: 760, height: 900 },
        mobile390: { width: 390, height: 844 },
        mobile360: { width: 360, height: 780 }
      })) {
        results.push(await runViewport(browser, name, viewport));
      }
      console.log(JSON.stringify({ ok: true, url: APP_URL, results }, null, 2));
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("[demo-bi-heatmap-layout-smoke] failed", error?.message || error);
    const output = server?.output?.() || "";
    if (output) console.error(output.slice(-4000));
    process.exitCode = 1;
  } finally {
    if (server) await stopServer(server.child);
    clearTimeout(watchdog);
  }
}

main();
