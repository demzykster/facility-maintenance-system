import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, webkit } from "playwright";

const PORT = Number(process.env.CMMS_DEMO_BI_HEATMAP_PORT || 5174);
const HOST = "127.0.0.1";
const APP_URL = process.env.CMMS_DEMO_BI_HEATMAP_URL || `http://${HOST}:${PORT}/`;
const SHOULD_START_DEV = !process.env.CMMS_DEMO_BI_HEATMAP_URL;
const LOGIN_ID = process.env.CMMS_DEMO_BI_HEATMAP_LOGIN || "owner@example.local";
const LOGIN_PASSWORD = process.env.CMMS_DEMO_BI_HEATMAP_PASSWORD || "demo1234";
const WATCHDOG_MS = Number(process.env.CMMS_DEMO_BI_HEATMAP_TIMEOUT_MS || 90000);
const MAX_DOC_OVERFLOW = 2;
const MAX_MOBILE_ROW_HEIGHT = 112;

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

function problematicTransportMarkup() {
  return `
    <div class="bi-transport-problem-list">
      <button type="button" class="bi-transport-problem-row" data-ticket-id="synthetic-transport-ticket">
        <span class="bi-transport-problem-main">
          <span class="bi-transport-problem-title">
            <b>T-908 · 194340</b>
            <small>נזק לתורן עקב העמסה שגויה עם תיאור ארוך לבדיקת קיטום</small>
          </span>
          <span class="bi-transport-problem-meta">
            <span>סגורה</span><span>מחסן</span><span>השבתה: 4 ימים</span><span>עלות: ₪420</span><span>21.07.26</span>
          </span>
          <span class="bi-transport-problem-reasons" aria-label="סיבות לחריגה">
            <em>נזק לא טבעי</em><em>השבתה מעל יומיים</em><em>נסגרה עם עלות</em>
          </span>
        </span>
        <span aria-hidden="true">‹</span>
      </button>
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

function verticalOverlap(topRect, bottomRect) {
  return Math.max(0, Math.min(topRect.bottom, bottomRect.bottom) - Math.max(topRect.top, bottomRect.top));
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

async function injectProblematicTransportRow(page) {
  await page.waitForSelector(".bi-transport-problem-panel", { timeout: 10000 });
  const result = await page.evaluate((markup) => {
    const panel = document.querySelector(".bi-transport-problem-panel");
    if (!panel) return { ok: false, reason: "panel_missing" };
    panel.querySelectorAll(".bi-transport-problem-list,.note").forEach((element) => element.remove());
    panel.insertAdjacentHTML("beforeend", markup);
    return { ok: true };
  }, problematicTransportMarkup());
  if (!result.ok) throw new Error(`problematic_transport_injection_failed:${result.reason}`);
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
    const nameMain = document.querySelector(".bi-heatmap-name-main");
    const domainTitle = document.querySelector(".bi-heatmap-name b");
    const domainCount = document.querySelector(".bi-heatmap-name small");
    const riskTags = document.querySelector(".bi-heatmap-risk-tags");
    const riskTagItems = [...document.querySelectorAll(".bi-heatmap-risk-tags i")];
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
      nameMain: rect(nameMain),
      domainTitle: rect(domainTitle),
      domainCount: rect(domainCount),
      riskTags: rect(riskTags),
      riskTagItems: riskTagItems.map(rect),
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

async function measureProblematicTransportLayout(page) {
  return page.evaluate(() => {
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const panel = document.querySelector(".bi-transport-problem-panel");
    const row = panel?.querySelector(".bi-transport-problem-row");
    const main = row?.querySelector(".bi-transport-problem-main");
    const title = row?.querySelector(".bi-transport-problem-title b");
    const subject = row?.querySelector(".bi-transport-problem-title small");
    const reasons = [...(row?.querySelectorAll(".bi-transport-problem-reasons em") || [])];
    if (!panel || !row || !main || !title || !subject || !reasons.length) {
      return { ok: false, reason: "problematic_transport_panel_incomplete" };
    }
    return {
      ok: true,
      direction: getComputedStyle(panel).direction,
      panel: rect(panel),
      row: rect(row),
      main: rect(main),
      title: rect(title),
      subject: rect(subject),
      reasons: reasons.map((reason) => ({ ...rect(reason), text: reason.textContent.trim() })),
      rowScrollWidth: row.scrollWidth,
      rowClientWidth: row.clientWidth,
      mainScrollWidth: main.scrollWidth,
      mainClientWidth: main.clientWidth
    };
  });
}

async function runViewport(browserTypeName, browser, name, viewport) {
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
  await injectProblematicTransportRow(page);
  const layout = await measureLayout(page);
  const problematicTransport = await measureProblematicTransportLayout(page);
  await page.screenshot({ path: `/tmp/cmms-bi-heatmap-layout-${browserTypeName}-${name}.png`, fullPage: true });

  const checkName = `${browserTypeName}:${name}`;
  if (layout.direction !== "rtl") throw new Error(`${checkName}:direction_not_rtl:${layout.direction}`);
  const allowedDocumentOverflow = Math.max(MAX_DOC_OVERFLOW, baselineDocumentOverflowX);
  if (layout.documentOverflowX > allowedDocumentOverflow) {
    throw new Error(`${checkName}:document_overflow_added:${JSON.stringify({ before: baselineDocumentOverflowX, after: layout.documentOverflowX })}`);
  }
  if (!layout.headerVisible) throw new Error(`${checkName}:domain_header_not_visible`);
  if (!layout.firstNameVisible) throw new Error(`${checkName}:first_column_not_visible`);
  assertClose(layout.firstHeader.left, layout.firstName.left, 1.5, `${checkName}:first_column_left_alignment`);
  assertClose(layout.firstHeader.right, layout.firstName.right, 1.5, `${checkName}:first_column_right_alignment`);
  if (layout.firstCell.right > layout.firstName.left) throw new Error(`${checkName}:first_metric_overlaps_domain_column`);
  if (viewport.width <= 760 && layout.rowHeight > MAX_MOBILE_ROW_HEIGHT) throw new Error(`${checkName}:mobile_row_too_tall:${layout.rowHeight}`);
  if (layout.domainTitle.width < 12) throw new Error(`${checkName}:domain_title_collapsed:${layout.domainTitle.width}`);
  if (layout.domainTitle.height < 12) throw new Error(`${checkName}:domain_title_clipped:${layout.domainTitle.height}`);
  if (layout.riskTags.height < 14) throw new Error(`${checkName}:risk_tags_clipped:${layout.riskTags.height}`);
  if (layout.riskTagItems.some((item) => item.height < 12 || item.width < 12)) throw new Error(`${checkName}:risk_tag_item_clipped`);
  for (let i = 0; i < layout.riskTagItems.length; i += 1) {
    for (let j = i + 1; j < layout.riskTagItems.length; j += 1) {
      const left = layout.riskTagItems[i];
      const right = layout.riskTagItems[j];
      if (horizontalOverlap(left, right) > 1 && verticalOverlap(left, right) > 1) {
        throw new Error(`${checkName}:risk_tag_items_overlap:${JSON.stringify({ left, right })}`);
      }
    }
  }
  if (layout.riskTags.bottom > layout.aiChip.top + 1) {
    throw new Error(`${checkName}:risk_tags_overlap_ai_chip:${JSON.stringify({ riskTags: layout.riskTags, aiChip: layout.aiChip })}`);
  }
  if (viewport.width <= 390) {
    const inside = (container, child) =>
      child.left >= container.left - 1 &&
      child.right <= container.right + 1 &&
      child.top >= container.top - 1 &&
      child.bottom <= container.bottom + 1;
    if (!inside(layout.firstName, layout.domainTitle)) throw new Error(`${checkName}:domain_title_outside_cell`);
    if (!inside(layout.firstName, layout.riskTags)) throw new Error(`${checkName}:risk_tags_outside_cell`);
    if (!inside(layout.firstName, layout.aiChip)) throw new Error(`${checkName}:ai_chip_outside_cell`);
    if (horizontalOverlap(layout.riskTags, layout.aiChip) > 1 && layout.riskTags.bottom > layout.aiChip.top) {
      throw new Error(`${checkName}:risk_tags_horizontal_layer_overlap_ai_chip`);
    }
  }
  if (!problematicTransport.ok) throw new Error(`${checkName}:${problematicTransport.reason}`);
  if (problematicTransport.direction !== "rtl") throw new Error(`${checkName}:problematic_transport_not_rtl`);
  if (problematicTransport.rowScrollWidth > problematicTransport.rowClientWidth + 1) {
    throw new Error(`${checkName}:problematic_transport_row_overflow`);
  }
  if (problematicTransport.mainScrollWidth > problematicTransport.mainClientWidth + 1) {
    throw new Error(`${checkName}:problematic_transport_content_overflow`);
  }
  if (problematicTransport.title.width < 12 || problematicTransport.subject.width < 12) {
    throw new Error(`${checkName}:problematic_transport_text_collapsed`);
  }
  const expectedReasons = ["נזק לא טבעי", "השבתה מעל יומיים", "נסגרה עם עלות"];
  if (!expectedReasons.every((reason) => problematicTransport.reasons.some((item) => item.text === reason))) {
    throw new Error(`${checkName}:problematic_transport_reasons_missing`);
  }
  for (let i = 0; i < problematicTransport.reasons.length; i += 1) {
    const reason = problematicTransport.reasons[i];
    if (reason.left < problematicTransport.main.left - 1 || reason.right > problematicTransport.main.right + 1) {
      throw new Error(`${checkName}:problematic_transport_reason_outside_row`);
    }
    for (let j = i + 1; j < problematicTransport.reasons.length; j += 1) {
      if (horizontalOverlap(reason, problematicTransport.reasons[j]) > 1 && verticalOverlap(reason, problematicTransport.reasons[j]) > 1) {
        throw new Error(`${checkName}:problematic_transport_reasons_overlap`);
      }
    }
  }
  if (consoleMessages.length) throw new Error(`${checkName}:console:${consoleMessages.slice(0, 3).join(" | ")}`);
  if (pageErrors.length) throw new Error(`${checkName}:pageerror:${pageErrors.slice(0, 3).join(" | ")}`);
  if (failedResponses.length) throw new Error(`${checkName}:responses:${failedResponses.slice(0, 3).join(" | ")}`);

  await page.close();

  return { browser: browserTypeName, name, viewport, baselineDocumentOverflowX, layout, problematicTransport };
}

async function main() {
  const server = SHOULD_START_DEV ? startDevServer() : null;
  try {
    await waitForServer(APP_URL);
    const results = [];
    const browserTypes = { chromium, webkit };
    const viewports = {
      desktop1440: { width: 1440, height: 900 },
      tablet760: { width: 760, height: 900 },
      mobile390: { width: 390, height: 844 },
      mobile360: { width: 360, height: 780 }
    };
    for (const [browserTypeName, browserType] of Object.entries(browserTypes)) {
      const browser = await browserType.launch({ headless: true });
      try {
        for (const [name, viewport] of Object.entries(viewports)) {
          results.push(await runViewport(browserTypeName, browser, name, viewport));
        }
      } finally {
        await browser.close();
      }
    }
    console.log(JSON.stringify({ ok: true, url: APP_URL, results }, null, 2));
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
