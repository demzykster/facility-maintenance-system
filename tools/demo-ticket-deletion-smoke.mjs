import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, webkit } from "playwright";

const HOST = "127.0.0.1";
const PORT = Number(process.env.CMMS_DELETION_SMOKE_PORT || 5176);
const APP_URL = `http://${HOST}:${PORT}/`;
const watchdog = setTimeout(() => {
  console.error("[demo-ticket-deletion-smoke] timed out");
  process.exit(124);
}, 90000);

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
  if (result?.[0] === "timeout" && child.exitCode == null && child.signalCode == null) child.kill("SIGKILL");
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(APP_URL);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("dev_server_not_ready");
}

async function runCase(browserType, browserName, viewport, track) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport, locale: "he-IL" });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await page.setContent(`<!doctype html><html lang="he" dir="rtl"><head><style>
      *{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden;font-family:Arial,sans-serif}
      main{width:min(100% - 24px,720px);margin:24px auto}.ticket{border:1px solid #d8dee8;padding:16px;border-radius:8px}
      button{min-height:44px;border:0;border-radius:8px;padding:10px 16px;background:#b91c1c;color:white}
      [role=alert]{margin-top:12px;background:#b91c1c;color:white;padding:10px}
    </style></head><body><main><article class="ticket" data-ticket-id="${track}-synthetic">
      <h1>${track === "facility" ? "קריאת מבנה סינתטית" : "קריאת שינוע סינתטית"}</h1>
      <button type="button">מחיקת הקריאה לצמיתות</button>
    </article></main></body></html>`);

    const result = await page.evaluate(async ({ track }) => {
      const { deleteTicketAndClose } = await import("/src/ticketDeletionModel.js");
      let tickets = [{ id: `${track}-synthetic`, track }, { id: "keep-ticket", track: "facility" }];
      const order = [];
      const deleteTicket = async (id) => {
        order.push(`delete:${id}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
        tickets = tickets.filter((ticket) => ticket.id !== id);
        document.querySelector(`[data-ticket-id="${id}"]`)?.remove();
        return true;
      };
      const onBack = () => order.push("back");
      const ok = await deleteTicketAndClose({ ticketId: `${track}-synthetic`, deleteTicket, onBack });
      return {
        ok,
        order,
        tickets,
        alert: document.querySelector("[role=alert]")?.textContent || "",
        direction: getComputedStyle(document.documentElement).direction,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    }, { track });

    if (!result.ok) throw new Error(`${browserName}_${track}_delete_failed`);
    if (result.order.join(",") !== `delete:${track}-synthetic,back`) throw new Error(`${browserName}_${track}_order:${result.order}`);
    if (result.tickets.some((ticket) => ticket.id === `${track}-synthetic`)) throw new Error(`${browserName}_${track}_state_stale`);
    if (result.alert) throw new Error(`${browserName}_${track}_error_banner:${result.alert}`);
    if (result.direction !== "rtl") throw new Error(`${browserName}_${track}_direction:${result.direction}`);
    if (result.overflow > 2) throw new Error(`${browserName}_${track}_overflow:${result.overflow}`);
    if (consoleErrors.length) throw new Error(`${browserName}_${track}_console:${consoleErrors.join(" | ")}`);
    return { browser: browserName, viewport, track, result };
  } finally {
    await browser.close();
  }
}

async function main() {
  const server = startDevServer();
  try {
    await waitForServer();
    const results = [];
    results.push(await runCase(chromium, "chromium-desktop", { width: 1440, height: 900 }, "facility"));
    results.push(await runCase(chromium, "chromium-mobile", { width: 390, height: 844 }, "transport"));
    results.push(await runCase(webkit, "webkit-desktop", { width: 1440, height: 900 }, "transport"));
    results.push(await runCase(webkit, "webkit-mobile", { width: 390, height: 844 }, "facility"));
    console.log(JSON.stringify({ ok: true, results }, null, 2));
  } catch (error) {
    console.error("[demo-ticket-deletion-smoke] failed", error?.message || error);
    const output = server.output();
    if (output) console.error(output.slice(-4000));
    process.exitCode = 1;
  } finally {
    await stopServer(server.child);
    clearTimeout(watchdog);
  }
}

main();
