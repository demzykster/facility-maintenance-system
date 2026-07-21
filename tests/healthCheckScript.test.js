import { execFile } from "node:child_process";
import http from "node:http";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const servers = [];

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      servers.push(server);
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

afterEach(async () => {
  while (servers.length) await closeServer(servers.pop());
});

describe("health smoke script", () => {
  it("requires an explicit URL", async () => {
    await expect(execFileAsync(process.execPath, ["tools/health-check.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, CMMS_HEALTH_BASE_URL: "" }
    })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("missing_health_url")
    });
  });

  it("exits successfully for a healthy response", async () => {
    const { url } = await listen((_req, res) => {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        status: "ok",
        version: "abc1234",
        checks: { api: "ok", configuration: "ok", database: "ok", storage: "ok" },
        timestamp: "2026-07-22T00:00:00.000Z"
      }));
    });

    const result = await execFileAsync(process.execPath, ["tools/health-check.mjs", "--url", url], {
      cwd: process.cwd(),
      env: { ...process.env, CMMS_HEALTH_BASE_URL: "" }
    });

    expect(result.stdout).toContain("Health ok:");
  });

  it("exits non-zero for a degraded response", async () => {
    const { url } = await listen((_req, res) => {
      res.statusCode = 503;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        status: "degraded",
        version: "abc1234",
        checks: { api: "ok", configuration: "ok", database: "failed", storage: "ok" },
        requestId: "req-health",
        timestamp: "2026-07-22T00:00:00.000Z"
      }));
    });

    await expect(execFileAsync(process.execPath, ["tools/health-check.mjs", "--url", url], {
      cwd: process.cwd(),
      env: { ...process.env, CMMS_HEALTH_BASE_URL: "" }
    })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("health_degraded")
    });
  });

  it("exits non-zero for malformed JSON and wrong content type", async () => {
    const malformed = await listen((_req, res) => {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end("{bad");
    });
    await expect(execFileAsync(process.execPath, ["tools/health-check.mjs", "--url", malformed.url], {
      cwd: process.cwd(),
      env: { ...process.env, CMMS_HEALTH_BASE_URL: "" }
    })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("health_malformed_json") });

    await closeServer(malformed.server);
    servers.splice(servers.indexOf(malformed.server), 1);

    const wrongType = await listen((_req, res) => {
      res.setHeader("content-type", "text/plain");
      res.end("ok");
    });
    await expect(execFileAsync(process.execPath, ["tools/health-check.mjs", "--url", wrongType.url], {
      cwd: process.cwd(),
      env: { ...process.env, CMMS_HEALTH_BASE_URL: "" }
    })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("health_wrong_content_type") });
  });

  it("exits non-zero on timeout", async () => {
    const { url } = await listen((_req, _res) => {});

    await expect(execFileAsync(process.execPath, ["tools/health-check.mjs", "--url", url, "--timeout", "20"], {
      cwd: process.cwd(),
      env: { ...process.env, CMMS_HEALTH_BASE_URL: "" }
    })).rejects.toMatchObject({ code: 1 });
  });
});
