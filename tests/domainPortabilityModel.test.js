import { describe, expect, it } from "vitest";
import {
  classifyDomainReference,
  parseDomainVerifyArgs,
  scanDomainCoupling,
  verifyDomainPortability
} from "../src/domainPortabilityModel.js";

const okVersion = { version: "0.1.0", commit: "dd58142bb9f9327d4348bd3860cfedafa0d58b9f" };
const okHealth = {
  status: "ok",
  version: "dd58142",
  checks: { api: "ok", configuration: "ok", database: "ok", storage: "ok" },
  timestamp: "2026-07-23T00:00:00.000Z"
};

function headers(type = "application/json; charset=utf-8") {
  return { get: (name) => name.toLowerCase() === "content-type" ? type : "" };
}

function jsonResponse(payload, { status = 200, ok = status >= 200 && status < 300, url = "" } = {}) {
  return {
    ok,
    status,
    url,
    headers: headers(),
    text: async () => JSON.stringify(payload)
  };
}

function textResponse(text = "ok", { status = 200, ok = status >= 200 && status < 300, url = "" } = {}) {
  return {
    ok,
    status,
    url,
    headers: headers("text/html; charset=utf-8"),
    text: async () => text
  };
}

function fetchFixture(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: String(options.method || "GET").toUpperCase() });
    const parsed = new URL(url);
    const key = `${parsed.pathname}${parsed.search}`;
    if (overrides.throwFor?.includes(key)) throw new Error("redirect loop detected");
    if (overrides[key]) return overrides[key](url, options);
    if (parsed.pathname === "/cmms-version.json") return jsonResponse(okVersion, { url });
    if (parsed.pathname === "/api/health") return jsonResponse(okHealth, { url });
    if (parsed.pathname === "/api/public/zones") return jsonResponse({ ok: true, zones: [] }, { url });
    return textResponse("<!doctype html>", { url });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

async function verify(overrides = {}) {
  return verifyDomainPortability({
    argv: [
      "--current-url", "https://facility-maintenance-system.vercel.app",
      "--candidate-url", "https://ogen.example.com",
      "--expected-sha", "dd58142"
    ],
    fetchImpl: fetchFixture(),
    now: () => "2026-07-23T00:00:00.000Z",
    ...overrides
  });
}

describe("domain portability model", () => {
  it("requires explicit current and candidate URLs", async () => {
    const result = await verifyDomainPortability({ argv: [], fetchImpl: fetchFixture() });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("missing_args:currentUrl,candidateUrl,expectedSha");
  });

  it("parses explicit arguments", () => {
    expect(parseDomainVerifyArgs([
      "--current-url=https://current.example.com",
      "--candidate-url", "https://candidate.example.com",
      "--expected-sha=abcdef1",
      "--timeout", "25"
    ])).toMatchObject({
      currentUrl: "https://current.example.com",
      candidateUrl: "https://candidate.example.com",
      expectedSha: "abcdef1",
      timeoutMs: 25
    });
  });

  it("rejects non-HTTPS candidate URLs", async () => {
    const result = await verifyDomainPortability({
      argv: [
        "--current-url", "https://facility-maintenance-system.vercel.app",
        "--candidate-url", "http://ogen.example.com",
        "--expected-sha", "dd58142"
      ],
      fetchImpl: fetchFixture()
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("candidate_url_requires_https");
  });

  it("fails on version mismatch", async () => {
    const result = await verify({
      fetchImpl: fetchFixture({
        "/cmms-version.json": (url) => jsonResponse({ ...okVersion, commit: "1111111" }, { url })
      })
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("current_version_mismatch");
    expect(result.errors).toContain("version_mismatch");
  });

  it("fails on degraded health", async () => {
    const result = await verify({
      fetchImpl: fetchFixture({
        "/api/health": (url) => jsonResponse({ ...okHealth, status: "degraded" }, { url, status: 503, ok: false })
      })
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("health_degraded");
  });

  it("detects redirect loops without exposing raw exception text", async () => {
    const result = await verify({
      fetchImpl: fetchFixture({ throwFor: ["/api/public/zones?cmms_probe=path-query"] })
    });
    const serialized = JSON.stringify(result);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("redirect_loop");
    expect(serialized).not.toContain("redirect loop detected");
  });

  it("detects redirects that lose path or query", async () => {
    const pathLoss = await verify({
      fetchImpl: fetchFixture({
        "/api/public/zones?cmms_probe=path-query": () => textResponse("ok", {
          url: "https://ogen.example.com/other?cmms_probe=path-query"
        })
      })
    });
    expect(pathLoss.errors).toContain("redirect_loses_path");

    const queryLoss = await verify({
      fetchImpl: fetchFixture({
        "/api/public/zones?cmms_probe=path-query": () => textResponse("ok", {
          url: "https://ogen.example.com/api/public/zones"
        })
      })
    });
    expect(queryLoss.errors).toContain("redirect_loses_query");
  });

  it("detects unexpected final host and unavailable public routes", async () => {
    const wrongHost = await verify({
      fetchImpl: fetchFixture({
        "/api/public/zones?cmms_probe=path-query": () => textResponse("ok", {
          url: "https://other.example.com/api/public/zones?cmms_probe=path-query"
        })
      })
    });
    expect(wrongHost.errors).toContain("unexpected_final_host");

    const unavailable = await verify({
      fetchImpl: fetchFixture({
        "/api/public/zones": (url) => jsonResponse({ ok: false }, { url, status: 404, ok: false })
      })
    });
    expect(unavailable.errors).toContain("route_unavailable");
    expect(unavailable.checks.public_cleaning_zones).toBe("failed");
  });

  it("passes for a safe candidate", async () => {
    const result = await verify();

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
    expect(result.checks).toMatchObject({
      currentVersion: "ok",
      candidateVersion: "ok",
      health: "ok",
      root_get: "ok",
      root_head: "ok",
      public_cleaning_zones: "ok",
      path_query_preservation: "ok"
    });
  });

  it("does not use mutation methods or print secrets", async () => {
    const fetchImpl = fetchFixture({
      "/api/health": () => {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY=secret redirect loop");
      }
    });
    const result = await verify({ fetchImpl });
    const serialized = JSON.stringify(result);

    expect(fetchImpl.calls.map((call) => call.method)).toEqual(["GET", "GET", "GET", "GET", "HEAD", "GET", "GET"]);
    expect(fetchImpl.calls.some((call) => /POST|PUT|PATCH|DELETE/.test(call.method))).toBe(false);
    expect(serialized).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serialized).not.toContain("secret");
    expect(result).toHaveProperty("ok");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("checks");
    expect(result).toHaveProperty("errors");
    expect(result).toHaveProperty("routes");
  });

  it("classifies repository domain coupling without treating docs and staging tooling as runtime risk", () => {
    const entries = scanDomainCoupling([
      { file: "docs/current-state.md", line: "https://facility-maintenance-system.vercel.app" },
      { file: "tools/staging-ui-smoke.mjs", line: "https://facility-maintenance-system.vercel.app" },
      { file: "src/example.js", line: "const origin = 'https://facility-maintenance-system.vercel.app'" },
      { file: "server/config.js", line: "const url = process.env.SUPABASE_URL" }
    ]);

    expect(classifyDomainReference(entries[0])).toBe("HARDCODED_SAFE");
    expect(entries.find((entry) => entry.file === "tools/staging-ui-smoke.mjs").classification).toBe("CONFIGURABLE");
    expect(entries.find((entry) => entry.file === "src/example.js").classification).toBe("HARDCODED_RISK");
    expect(classifyDomainReference({ file: "server/config.js", line: "const url = process.env.SUPABASE_URL" })).toBe("DOMAIN_INDEPENDENT");
  });
});
