import { chromium } from "playwright";

const appUrl = process.env.CMMS_BROWSER_SMOKE_URL || process.env.CMMS_PUBLIC_APP_URL || "https://facility-maintenance-system.vercel.app/";

const relevantConsoleMessage = (message) => {
  const text = String(message.text || "");
  return message.type === "error" || /init error|supabase_access_token_required|storage_api_/i.test(text);
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const failed = [];
    const unauthKv = [];
    const consoleMessages = [];

    page.on("console", (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on("response", (response) => {
      const url = response.url();
      if (response.status() >= 400) failed.push({ status: response.status(), url });
      if (response.status() === 401 && url.includes("/api/kv")) unauthKv.push(url);
    });

    await page.goto(appUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);

    const emailVisible = await page.locator('input[placeholder="owner@example.com"]').isVisible().catch(() => false);
    const relevantConsole = consoleMessages.filter(relevantConsoleMessage);
    const relevantFailures = failed.filter((item) => !/favicon\\.ico$/.test(item.url));
    const ok = emailVisible && unauthKv.length === 0 && relevantConsole.length === 0 && relevantFailures.length === 0;

    const report = {
      ok,
      url: appUrl,
      emailVisible,
      failedCount: relevantFailures.length,
      unauthKvCount: unauthKv.length,
      consoleErrorCount: relevantConsole.length,
      failed: relevantFailures.slice(0, 10),
      consoleMessages: relevantConsole.slice(0, 10)
    };

    console.log(JSON.stringify(report, null, 2));
    if (!ok) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[staging-browser-smoke] failed", error?.message || error);
  process.exit(1);
});
