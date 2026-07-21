import { describe, expect, it } from "vitest";
import { VERCEL_API_ROUTE_FILES, vercelApiRoutePolicy } from "../src/vercelApiRouteModel.js";

describe("Vercel API route policy", () => {
  it("accepts only the intentional endpoint files under api", () => {
    expect(vercelApiRoutePolicy(VERCEL_API_ROUTE_FILES).ok).toBe(true);
    expect(VERCEL_API_ROUTE_FILES).toContain("api/ai/[action].js");
    expect(VERCEL_API_ROUTE_FILES).toContain("api/[diagnostic].js");
    expect(VERCEL_API_ROUTE_FILES).toContain("api/cleaning/records.js");
    expect(VERCEL_API_ROUTE_FILES).toContain("api/manifest.js");
    expect(VERCEL_API_ROUTE_FILES).toContain("api/presence/index.js");
    expect(VERCEL_API_ROUTE_FILES).toContain("api/ppe/index.js");
    expect(VERCEL_API_ROUTE_FILES).toContain("api/public/[resource].js");
    expect(VERCEL_API_ROUTE_FILES).toContain("api/session/[action].js");
    expect(VERCEL_API_ROUTE_FILES).toContain("api/settings/config.js");
    expect(VERCEL_API_ROUTE_FILES).toContain("api/settings/records.js");
    expect(VERCEL_API_ROUTE_FILES).toContain("api/work/index.js");
    expect(VERCEL_API_ROUTE_FILES).not.toContain("api/cleaning/rounds.js");
    expect(VERCEL_API_ROUTE_FILES).not.toContain("api/cleaning/zones.js");
    expect(VERCEL_API_ROUTE_FILES).not.toContain("api/public/complaints.js");
    expect(VERCEL_API_ROUTE_FILES).not.toContain("api/public/zones.js");
    expect(VERCEL_API_ROUTE_FILES).not.toContain("api/session/login.js");
    expect(VERCEL_API_ROUTE_FILES).not.toContain("api/session/me.js");
    expect(VERCEL_API_ROUTE_FILES).not.toContain("api/client-errors.js");
    expect(VERCEL_API_ROUTE_FILES).not.toContain("api/system-errors.js");
    expect(VERCEL_API_ROUTE_FILES).not.toContain("api/ai/assist.js");
    expect(VERCEL_API_ROUTE_FILES).not.toContain("api/ai/intake.js");
    expect(VERCEL_API_ROUTE_FILES).not.toContain("api/ai/status.js");
  });

  it("rejects helper files under api because Vercel deploys them as functions", () => {
    const result = vercelApiRoutePolicy([
      ...VERCEL_API_ROUTE_FILES,
      "api/kv/handler.js",
      "api/files/supabaseFileDriver.js"
    ]);

    expect(result.ok).toBe(false);
    expect(result.unexpected).toEqual([
      "api/files/supabaseFileDriver.js",
      "api/kv/handler.js"
    ]);
    expect(result.errors[0]).toContain("unexpected_api_route_files");
  });

  it("keeps the API route budget visible", () => {
    const result = vercelApiRoutePolicy([
      ...VERCEL_API_ROUTE_FILES,
      "api/x/1.js",
      "api/x/2.js",
      "api/x/3.js",
      "api/x/4.js",
      "api/x/5.js",
      "api/x/6.js",
      "api/x/7.js",
      "api/x/8.js",
      "api/x/9.js",
      "api/x/10.js",
      "api/x/11.js",
      "api/x/12.js"
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("api_route_count_exceeds_limit:32/24");
  });
});
